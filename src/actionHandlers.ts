import type Client from "./Client.js";
import { InsaneInt } from "./InsaneInt.js";
import Lobby, { getHostID, getOtherPlayers } from "./Lobby.js";
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
  ActionRemovePhantom,
  ActionSendPhantom,
  ActionSetAnte,
  ActionSetLocation,
  ActionSetFurthestBlind,
  ActionSkip,
  ActionStartAnteTimer,
  ActionPauseAnteTimer,
  ActionSyncClient,
  ActionUsername,
  ActionVersion,
  ActionSetBossBlind,
  ActionLobbyOptions,
  ActionReceiveNemesisStatsRequest,
  ActionSendPlayerDeck,
  ActionSetLobbyReady,
  ActionSpentLastShopRequest,
  ActionClientGameStateUpdate,
} from "./actions.js";
import { generateSeed } from "./utils.js";

const usernameAction = (
  { username, colour, modHash }: ActionHandlerArgs<ActionUsername>,
  client: Client
) => {
  client.lobbyData.username = username;
  client.lobbyData.colour = colour;
  client.lobbyData.modHash = modHash;
};

const createLobbyAction = (
  { ruleset, gameMode }: ActionHandlerArgs<ActionCreateLobby>,
  client: Client
) => {
  /** Also sets the client lobby to this newly created one */
  new Lobby(client, ruleset, gameMode);
};

const loseGameAction = (client: Client) => {
  if (!client.lobby) return;

  if (client.lobby.gameMode === "coopSurvival") {
    client.sendAction({ action: "loseGame" });
    return;
  }

  const [lobby, others] = getOtherPlayers(client);

  if (!lobby) return;

  if (lobby.gameMode === "survival") {
    const players = lobby.players;
    const alive = players.filter((p) => p.gameState.lives > 0);

    if (alive.length === 0) {
      // All players are dead, determine winners by furthest_blind
      const maxBlind = Math.max(
        ...players.map((p) => p.gameState.furthest_blind)
      );
      const winners = players.filter(
        (p) => p.gameState.furthest_blind === maxBlind
      );

      players.forEach((p) => {
        if (winners.includes(p)) {
          p.sendAction({ action: "winGame" });
        } else {
          p.sendAction({ action: "loseGame" });
        }
      });
      return;
    }
  }

  if (others.length === 1) {
    others[0].sendAction({ action: "winGame" });
    client.sendAction({ action: "loseGame" });
    return;
  }
};

const joinLobbyAction = (
  { code }: ActionHandlerArgs<ActionJoinLobby>,
  client: Client
) => {
  const newLobby = Lobby.get(code);
  if (!newLobby) {
    client.sendAction({
      action: "invalidLobby",
    });
    return;
  }
  newLobby.join(client);
  client.onLoseGame = loseGameAction;
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

const updateClientGameStateAction = (
  { updates }: ActionHandlerArgs<ActionClientGameStateUpdate>,
  client: Client
) => {
  if (updates.score) updates.score = InsaneInt.fromString(updates.score.toString());
  if (updates.highest_score) updates.highest_score = InsaneInt.fromString(updates.highest_score.toString());
  client.setGameStateValues(updates);
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
    player.gameState.lives = lives;
  });

  const playerStates = lobby.players.map((player) => ({
    id: player.id,
    ...player.gameState,
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
  client.lobbyData.isReady = true;
  const [lobby, others] = getOtherPlayers(client);

  // If this client is the first to ready up, trigger speedrun
  const isFirstReady =
    !client.lobbyData.firstReady &&
    others.every((p) => !p.lobbyData.isReady && !p.lobbyData.firstReady);

  if (isFirstReady) {
    client.lobbyData.firstReady = true;
    client.sendAction({ action: "speedrun" });
  }

  // If all players are ready, reset for next blind and start it
  if (lobby && lobby.players.every((p) => p.lobbyData.isReady)) {
    lobby.players.forEach((p) => {
      p.lobbyData.isReady = false;
      p.setGameStateValues({ score: new InsaneInt(0, 0, 0) });
    });
    lobby.broadcastAction({ action: "startBlind" });
  }
};

const unreadyBlindAction = (client: Client) => {
  client.lobbyData.isReady = false;
};

// Helper: check if all players have played their hands
function allPlayersHandsPlayed(lobby: Lobby): boolean {
  return lobby.players.every((p) => p.gameState.hands_left === 0);
}

const setLobbyReadyAction = (
  { isReady }: ActionHandlerArgs<ActionSetLobbyReady>,
  client: Client
) => {
  client.lobbyData.isReady = isReady;

  const [lobby, others] = getOtherPlayers(client);
  others.forEach((p) => {
    p.sendAction({
      action: "setLobbyReady",
      isReady,
      playerId: client.id,
    });
  });
};

// Helper: resolve PvP round
const resolvePvPRound = (lobby: Lobby) => {
  let maxScore = lobby.players[0].gameState.score;
  lobby.players.forEach((p) => {
    if (p.gameState.score.greaterThan(maxScore)) maxScore = p.gameState.score;
  });
  const winners = lobby.players.filter((p) =>
    p.gameState.score.equalTo(maxScore)
  );
  const losers = lobby.players.filter(
    (p) => !p.gameState.score.equalTo(maxScore)
  );

  losers.forEach((loser) => {
    loser.loseLives(1);
  });

  lobby.players.forEach((p) => (p.lobbyData.firstReady = false));

  lobby.players.forEach((p) => {
    p.sendAction({ action: "endPvP", lost: losers.includes(p) });
  });
};

const resolveCoopSurvivalRound = (
  target_score: string | undefined,
  lobby: Lobby
) => {
  const bossTargetScore = InsaneInt.fromString(target_score?.toString() || "0");
  console.log("ending coop survival round");

  // Sum all player scores
  const totalScore = lobby.players.reduce(
    (sum, p) => sum.add(p.gameState.score),
    new InsaneInt(0, 0, 0)
  );

  if (bossTargetScore.greaterThan(totalScore)) {
    lobby?.loseSharedLives();
    lobby?.broadcastAction({ action: "endPvP", lost: true });
  }
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

  const scoreDiff = InsaneInt.fromString(String(score));
  client.setGameStateValues({
    score: client.gameState.score.add(scoreDiff),
    hands_left: hands_left,
  });

  if (!allPlayersHandsPlayed(lobby)) return;

  if (lobby.gameMode === "coopSurvival") {
    resolveCoopSurvivalRound(target_score, lobby);
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

const lobbyOptionsAction = (
  { options }: ActionHandlerArgs<ActionLobbyOptions>,
  client: Client
) => {
  client.lobby?.setOptions(options);
};

const failRoundAction = (client: Client) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;

  // Handle death on round loss based on lobby options and game mode
  if (lobby.options.death_on_round_loss) {
    if (lobby.gameMode === "coopSurvival") {
      lobby.loseSharedLives(1);
    } else {
      client.loseLives(1);
    }
  }
};

const setAnteAction = (
  { ante }: ActionHandlerArgs<ActionSetAnte>,
  client: Client
) => {
  client.gameState.ante = ante;
};

// TODO: Fix this
const serverVersion = "0.2.11-MULTIPLAYER";
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
  client.setGameStateValues({
    location,
  });
};

const newRoundAction = (client: Client) => {
  client.setGameStateValues({
    score: new InsaneInt(0, 0, 0),
    lives_blocker: false,
  });
};

const setFurthestBlindAction = (
  { furthest_blind }: ActionHandlerArgs<ActionSetFurthestBlind>,
  client: Client
) => {
  client.setGameStateValues({
    furthest_blind: furthest_blind,
  });
};

const skipAction = (
  { skips }: ActionHandlerArgs<ActionSkip>,
  client: Client
) => {
  client.setGameStateValues({
    skips: skips,
  });
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
  { amount }: ActionHandlerArgs<ActionSpentLastShopRequest>,
  client: Client
) => {
  client.gameState.spent_in_shop.push(amount);
  const [lobby, _] = getOtherPlayers(client);
  if (!lobby) return;
  lobby.broadcastAction({
    action: "spentLastShop",
    playerId: client.id,
    amount,
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

const sendPlayerDeckAction = (
  { cards }: ActionHandlerArgs<ActionSendPlayerDeck>,
  client: Client
) => {
  const [lobby, enemies] = getOtherPlayers(client);
  if (!lobby) return;
  enemies.forEach((enemy) => {
    enemy.sendAction({
      action: "receivePlayerDeck",
      playerId: client.id,
      cards,
    });
  });
};

const requestNemesisStatsActionHandler = (client: Client) => {
  const [lobby, others] = getOtherPlayers(client);
  if (!lobby || !others) return;
  others.forEach((p) => {
    p.sendAction({
      action: "endGameStatsRequested",
    });
  });
};

const receiveNemesisStatsActionHandler = (
  stats: ActionHandlerArgs<ActionReceiveNemesisStatsRequest>,
  client: Client
) => {
  const [lobby, others] = getOtherPlayers(client);
  if (!lobby || !others) return;

  others.forEach((p) => {
    p.sendAction({
      action: "nemesisEndGameStats",
      ...stats,
    });
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
  if (!lobby) return;
  client.loseLives(1);
};

const syncClientAction = (
  { isCached }: ActionHandlerArgs<ActionSyncClient>,
  client: Client
) => {
  client.lobbyData.isCached = isCached;
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
  setLobbyReady: setLobbyReadyAction,
  playHand: playHandAction,
  stopGame: stopGameAction,
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
  sendPlayerDeck: sendPlayerDeckAction,
  startAnteTimer: startAnteTimerAction,
  pauseAnteTimer: pauseAnteTimerAction,
  failTimer: failTimerAction,
  syncClient: syncClientAction,
  endGameStatsRequested: requestNemesisStatsActionHandler,
  nemesisEndGameStats: receiveNemesisStatsActionHandler,
  setBossBlind: setBossBlindAction,
  updatePlayerGameState: updateClientGameStateAction,
} satisfies Partial<ActionHandlers>;
