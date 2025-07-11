import type Client from "./Client.js";
import { InsaneInt } from "./InsaneInt.js";
import Lobby, { getHostID, getOtherPlayers} from "./Lobby.js";
import type {
  ActionCreateLobby,
  ActionEatPizza,
  ActionHandlerArgs,
  ActionHandlers,
  ActionJoinLobby,
  ActionMagnet,
  ActionMagnetResponse,
  ActionPlayHand,
  ActionReceiveEndGameJokersRequest,
  ActionReceiveNemesisDeckRequest,
  ActionRemovePhantom,
  ActionSendPhantom,
  ActionSetAnte,
  ActionSetLocation,
  ActionSetFurthestBlind,
  ActionSkip,
  ActionSpentLastShop,
  ActionStartAnteTimer,
  ActionPauseAnteTimer,
  ActionSyncClient,
  ActionUsername,
  ActionVersion,
  ActionSetBossBlind,
  ActionLobbyOptions,
} from "./actions.js";
import { generateSeed } from "./utils.js";

const usernameAction = (
  { username, colour, modHash }: ActionHandlerArgs<ActionUsername>,
  client: Client
) => {
  client.setUsername(username);
  client.setColour(colour);
  client.setModHash(modHash);
};

const createLobbyAction = (
  { ruleset, gameMode }: ActionHandlerArgs<ActionCreateLobby>,
  client: Client
) => {
  /** Also sets the client lobby to this newly created one */
  new Lobby(client, ruleset, gameMode);
};

const joinLobbyAction = (
  { code }: ActionHandlerArgs<ActionJoinLobby>,
  client: Client
) => {
  const newLobby = Lobby.get(code);
  if (!newLobby) {
    client.sendAction({
      action: "error",
      message: "Lobby does not exist.",
    });
    return;
  }
  newLobby.join(client);
};

const leaveLobbyAction = (client: Client) => {
  client.lobby?.leave(client);
};

const lobbyInfoAction = (client: Client) => {
  client.lobby?.broadcastLobbyInfo();
};

const keepAliveAction = (client: Client) => {
  // Send an ack back to the received keepAlive
  client.sendAction({ action: "keepAliveAck" });
};

const startGameAction = (client: Client) => {
  const lobby = client.lobby;
  // Only allow the host to start the game
  if (!lobby || getHostID(client) !== client.id) {
    console.warn("Attempted to start game without being host");
    return;
  }

  // Determine starting lives from options or game mode default
  const lives = lobby.options.starting_lives;

  // Set all player lives before broadcasting
  lobby.players.forEach((player) => {
    player.resetState();
    player.lives = lives;
  });

  const playerStates = lobby.players.map((player) => ({
    id: player.id,
    score: player.score.toString(),
    highest_score: player.highest_score.toString(), // convert to string
    lives: player.lives,
    hands_left: player.hands_left,
    ante: player.ante,
    skips: player.skips,
    furthest_blind: player.furthest_blind,
    lives_blocker: player.lives_blocker,
    location: player.location,
  }));

  // Send initial game state for all players as a batch of gameStateUpdate actions
  lobby.broadcastAction({
    action: "startGame",
    deck: "c_multiplayer_1",
    seed: lobby.options.different_seeds ? undefined : generateSeed(),
    players: playerStates,
  });
};

const readyBlindAction = (client: Client) => {
  client.isReady = true;

  const [lobby, others] = getOtherPlayers(client);

  if (!client.firstReady && others.every((p) => !p.isReady && !p.firstReady)) {
    client.firstReady = true;
    client.sendAction({ action: "speedrun" });
  }

  if (client.lobby && client.lobby.players.every((p) => p.isReady)) {
    // Reset ready status for next blind
    client.lobby.players.forEach((p) => (p.isReady = false));
    // Reset scores and hands left for next blind
    client.lobby.players.forEach((p) => {
      p.score = new InsaneInt(0, 0, 0);
      p.hands_left = 4;
    });

    // Some reason score is not reset
    client.lobby.players.forEach((p) => {
      p.score = new InsaneInt(0, 0, 0);
      broadcastGameStateUpdate(p, {
        score: p.score.toString(),
      });
    });

    client.lobby.broadcastAction({ action: "startBlind" });
  }
};

const unreadyBlindAction = (client: Client) => {
  client.isReady = false;
};

// Helper: check if all players have played their hands
function allPlayersHandsPlayed(lobby: Lobby): boolean {
  return lobby.players.every((p) => p.hands_left === 0);
}

// Helper: broadcast game state updates efficiently
function broadcastGameStateUpdate(
  client: Client,
  updates: Partial<{
    lives: number;
    score: string;
    highest_score: string;
    hands_left: number;
    ante: number;
    skips: number;
    furthest_blind: number;
    lives_blocker: boolean;
    location: string;
  }>
) {
  if (!client.lobby) return;

  client.lobby.players.forEach((player) => {
    player.sendAction({
      action: "gameStateUpdate",
      id: client.id,
      updates,
    });
  });
}

// Helper: resolve PvP round
const resolvePvPRound = (lobby: Lobby) => {
  let maxScore = lobby.players[0].score;
  lobby.players.forEach((p) => {
    if (p.score.greaterThan(maxScore)) maxScore = p.score;
  });
  const winners = lobby.players.filter((p) => p.score.equalTo(maxScore));
  const losers = lobby.players.filter((p) => !p.score.equalTo(maxScore));

  if (winners.length < lobby.players.length) {
    losers.forEach((loser) => {
      loser.loseLife();
    });
    const alive = lobby.players.filter((p) => p.lives > 0);
    if (alive.length === 1) {
      alive[0].sendAction({ action: "winGame" });
      lobby.players.forEach((p) => {
        if (p !== alive[0]) p.sendAction({ action: "loseGame" });
      });
      return;
    }
  }
  lobby.players.forEach((p) => (p.firstReady = false));
  winners.forEach((winner) =>
    winner.sendAction({ action: "endPvP", lost: false })
  );
  losers.forEach((loser) => loser.sendAction({ action: "endPvP", lost: true }));
};

// Action handler for playing a hand
const playHandAction = (
  { hands_left, score, target_score }: ActionHandlerArgs<ActionPlayHand>,
  client: Client
) => {
  const [lobby, others] = getOtherPlayers(client);
  if (!lobby) {
    stopGameAction(client);
    return;
  }

  client.score = InsaneInt.fromString(String(score));
  client.hands_left =
    typeof hands_left === "number" ? hands_left : Number(hands_left);

  broadcastGameStateUpdate(client, {
    score: client.score.toString(),
    hands_left: client.hands_left,
  });

  if (!allPlayersHandsPlayed(lobby)) return;

  if (lobby.gameMode === "coopSurvival") {
    const bossTargetScore = InsaneInt.fromString(
      target_score?.toString() || "0"
    );
    console.log("ending coop survival round");

    // Sum all player scores
    const totalScore = lobby.players.reduce(
      (sum, p) => sum.add(p.score),
      new InsaneInt(0, 0, 0)
    );

    if (bossTargetScore.greaterThan(totalScore)) {
      // Boss not defeated
      if (client.lives === 1) {
        // All players lose the game
        lobby.players.forEach((p) => {
          p.sendAction({ action: "loseGame" });
        });
      } else {
        // Players lose a life and reset score
        lobby.players.forEach((p) => {
          p.score = new InsaneInt(0, 0, 0);
          broadcastGameStateUpdate(p, {
            score: p.score.toString(),
          })
          p.loseLife(true);
          p.sendAction({ action: "endPvP", lost: true });
        });
      }
    }
    // If boss defeated, do nothing (could add win logic here if needed)
  } else {
    resolvePvPRound(lobby);
  }
};

const stopGameAction = (client: Client) => {
  if (!client.lobby) {
    return;
  }
  client.lobby.broadcastAction({ action: "stopGame" });
  client.lobby.resetPlayers();
};

// Deprecated
const gameInfoAction = (client: Client) => {
  client.lobby?.sendGameInfo(client);
};

const lobbyOptionsAction = (
  { options }: ActionHandlerArgs<ActionLobbyOptions>,
  client: Client
) => {
  client.lobby?.setOptions(options);
};

const failRoundAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;

  if (lobby.options.death_on_round_loss) {
    client.loseLife();
  }

  if (client.lives === 0) {
    if (lobby.gameMode === "survival") {
      // Survival: check if all are dead or who got furthest
      const alive = lobby.players.filter((p) => p.lives > 0);
      if (alive.length === 0) {
        // All dead, check furthestBlind for all
        const maxBlind = Math.max(
          ...lobby.players.map((p) => p.furthest_blind)
        );
        const winners = lobby.players.filter(
          (p) => p.furthest_blind === maxBlind
        );
        winners.forEach((w) => w.sendAction({ action: "winGame" }));
        lobby.players.forEach((p) => {
          if (!winners.includes(p)) p.sendAction({ action: "loseGame" });
        });
      } else {
        // Some alive, check if any alive have higher furthestBlind
        const maxBlind = Math.max(...alive.map((p) => p.furthest_blind));
        alive.forEach((p) => {
          if (p.furthest_blind === maxBlind) {
            p.sendAction({ action: "winGame" });
          } else {
            p.sendAction({ action: "loseGame" });
          }
        });
      }
    } else {
      // Elimination: if only one left, they win
      const alive = lobby.players.filter((p) => p.lives > 0);
      if (alive.length === 1) {
        alive[0].sendAction({ action: "winGame" });
        lobby.players.forEach((p) => {
          if (p !== alive[0]) p.sendAction({ action: "loseGame" });
        });
      }
    }
  }
};

const setAnteAction = (
  { ante }: ActionHandlerArgs<ActionSetAnte>,
  client: Client
) => {
  client.ante = ante;
};

// TODO: Fix this
const serverVersion = "0.2.7-MULTIPLAYER";
/** Verifies the client version and allows connection if it matches the server's */
const versionAction = (
  { version }: ActionHandlerArgs<ActionVersion>,
  client: Client
) => {
  const versionMatch = version.match(/^(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    const clientVersion = versionMatch[1];
    const serverVersionNumber = serverVersion.split("-")[0];

    const [clientMajor, clientMinor, clientPatch] = clientVersion
      .split(".")
      .map(Number);
    const [serverMajor, serverMinor, serverPatch] = serverVersionNumber
      .split(".")
      .map(Number);

    if (
      clientMajor < serverMajor ||
      (clientMajor === serverMajor && clientMinor < serverMinor) ||
      (clientMajor === serverMajor &&
        clientMinor === serverMinor &&
        clientPatch < serverPatch)
    ) {
      client.sendAction({
        action: "error",
        message: `[WARN] Server expecting version ${serverVersion}`,
      });
    }
  }
};

const setLocationAction = (
  { location }: ActionHandlerArgs<ActionSetLocation>,
  client: Client
) => {
  client.setLocation(location);
};

const newRoundAction = (client: Client) => {
  client.resetBlocker();
  client.score = new InsaneInt(0, 0, 0);
};

const setFurthestBlindAction = (
  { furthest_blind }: ActionHandlerArgs<ActionSetFurthestBlind>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  client.furthest_blind = furthest_blind;
  if (!lobby) return;

  if (lobby.gameMode === "survival") {
    const allDead = lobby.players.every((p) => p.lives === 0);
    if (allDead) {
      const maxBlind = Math.max(...lobby.players.map((p) => p.furthest_blind));
      const winners = lobby.players.filter(
        (p) => p.furthest_blind === maxBlind
      );
      winners.forEach((w) => w.sendAction({ action: "winGame" }));
      lobby.players.forEach((p) => {
        if (!winners.includes(p)) p.sendAction({ action: "loseGame" });
      });
    }
  }
};

const skipAction = (
  { skips }: ActionHandlerArgs<ActionSkip>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  client.setSkips(skips);
  if (!lobby) return;

  // Broadcast just the skips change
  broadcastGameStateUpdate(client, { skips });
};

const sendPhantomAction = (
  { key }: ActionHandlerArgs<ActionSendPhantom>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "sendPhantom", key });
  });
};

const removePhantomAction = (
  { key }: ActionHandlerArgs<ActionRemovePhantom>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "removePhantom", key });
  });
};

const asteroidAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "asteroid" });
  });
};

const letsGoGamblingNemesisAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "letsGoGamblingNemesis" });
  });
};

const eatPizzaAction = (
  { whole }: ActionHandlerArgs<ActionEatPizza>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "eatPizza", whole });
  });
};

const soldJokerAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "soldJoker" });
  });
};

const spentLastShopAction = (
  { amount }: ActionHandlerArgs<ActionSpentLastShop>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "spentLastShop", amount });
  });
};

const magnetAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "magnet" });
  });
};

const magnetResponseAction = (
  { key }: ActionHandlerArgs<ActionMagnetResponse>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "magnetResponse", key });
  });
};

const getEndGameJokersAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "getEndGameJokers" });
  });
};

const receiveEndGameJokersAction = (
  { keys }: ActionHandlerArgs<ActionReceiveEndGameJokersRequest>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "receiveEndGameJokers", keys });
  });
};

const getNemesisDeckAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "getNemesisDeck" });
  });
};

const receiveNemesisDeckAction = (
  { cards }: ActionHandlerArgs<ActionReceiveNemesisDeckRequest>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "receiveNemesisDeck", cards });
  });
};

const startAnteTimerAction = (
  { time }: ActionHandlerArgs<ActionStartAnteTimer>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "startAnteTimer", time });
  });
};

const pauseAnteTimerAction = (
  { time }: ActionHandlerArgs<ActionPauseAnteTimer>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({ action: "pauseAnteTimer", time });
  });
};

const failTimerAction = (client: Client) => {
  const lobby = client.lobby;
  client.loseLife();
  if (!lobby) return;
  if (client.lives === 0) {
    const alive = lobby.players.filter((p) => p.lives > 0);
    if (alive.length === 1) {
      alive[0].sendAction({ action: "winGame" });
      lobby.players.forEach((p) => {
        if (p !== alive[0]) p.sendAction({ action: "loseGame" });
      });
    }
  }
};

const syncClientAction = (
  { isCached }: ActionHandlerArgs<ActionSyncClient>,
  client: Client
) => {
  client.isCached = isCached;
};

const setBossBlindAction = (
  { bossKey }: ActionHandlerArgs<ActionSetBossBlind>,
  client: Client
) => {
  const lobby = client.lobby;
  if (!lobby) return;
  // Only allow the host to set the boss blind
  if (getHostID(client) !== client.id) return;

  // Send to all non-hosts
  lobby.players.forEach((player) => {
    if (player !== client) {
      player.sendAction({
        action: "setBossBlind",
        bossKey,
      });
    }
  });
};

export const actionHandlers = {
  username: usernameAction,
  createLobby: createLobbyAction,
  joinLobby: joinLobbyAction,
  lobbyInfo: lobbyInfoAction,
  leaveLobby: leaveLobbyAction,
  keepAlive: keepAliveAction,
  startGame: startGameAction,
  readyBlind: readyBlindAction,
  unreadyBlind: unreadyBlindAction,
  playHand: playHandAction,
  stopGame: stopGameAction,
  gameInfo: gameInfoAction,
  lobbyOptions: lobbyOptionsAction,
  failRound: failRoundAction,
  setAnte: setAnteAction,
  version: versionAction,
  setLocation: setLocationAction,
  newRound: newRoundAction,
  setFurthestBlind: setFurthestBlindAction,
  skip: skipAction,
  sendPhantom: sendPhantomAction,
  removePhantom: removePhantomAction,
  asteroid: asteroidAction,
  letsGoGamblingNemesis: letsGoGamblingNemesisAction,
  eatPizza: eatPizzaAction,
  soldJoker: soldJokerAction,
  spentLastShop: spentLastShopAction,
  magnet: magnetAction,
  magnetResponse: magnetResponseAction,
  getEndGameJokers: getEndGameJokersAction,
  receiveEndGameJokers: receiveEndGameJokersAction,
  getNemesisDeck: getNemesisDeckAction,
  receiveNemesisDeck: receiveNemesisDeckAction,
  startAnteTimer: startAnteTimerAction,
  pauseAnteTimer: pauseAnteTimerAction,
  failTimer: failTimerAction,
  syncClient: syncClientAction,
  setBossBlind: setBossBlindAction,
} satisfies Partial<ActionHandlers>;
