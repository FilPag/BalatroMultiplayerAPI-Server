import { GameStateData, LobbyData } from "./Client.js";
import { LobbyOptions } from "./Lobby.js";

// Server to Client
type StateActionData = Partial<Omit<GameStateData, 'score' | 'highest_score' > & { score: string; highest_score: string}>
export type ActionConnected = { action: 'connected' }
export type ActionError = { action: 'error'; message: string }
export type ActionJoinedLobby = { action: 'joinedLobby'; code: string; }
export type ActionLobbyInfo = {
	action: 'lobbyInfo'
	host: string
	isHost: boolean
	players?: Array<LobbyData & { id: string }>
	local_id?: string
}
export type ActionStopGame = { action: 'stopGame' }
export type ActionStartGame = {
  action: 'startGame'
  deck: string
  stake?: number
  seed?: string
  players: Array<StateActionData & {id: string}>
}
export type ActionStartBlind = { action: 'startBlind' }
export type ActionWinGame = { action: 'winGame' }
export type ActionLoseGame = { action: 'loseGame' }
export type ActionGameInfo = {
	action: 'gameInfo'
	small?: string
	big?: string
	boss?: string
}

// Generic game state update action - can update any combination of game state fields
export type ActionGameStateUpdate = { 
  action: 'gameStateUpdate'
  id: string
  updates: StateActionData
}
export type ActionEndPvP = { action: 'endPvP'; lost: boolean }
export type ActionLobbyOptions = { action: 'lobbyOptions', options: LobbyOptions}
export type ActionRequestVersion = { action: 'version' }
export type ActionEnemyLocation = { action: 'enemyLocation'; playerId: string; location: string }
export type ActionSendPhantom = { action: 'sendPhantom', key: string }
export type ActionRemovePhantom = { action: 'removePhantom', key: string }
export type ActionSpeedrun = { action: 'speedrun' }
export type ActionAsteroid = { action: 'asteroid' }
export type ActionLetsGoGamblingNemesis = { action: 'letsGoGamblingNemesis' }
export type ActionEatPizza = { action: 'eatPizza', whole: boolean }
export type ActionSoldJoker = { action: 'soldJoker' }
export type ActionSpentLastShop = { action: 'spentLastShop', amount: number }
export type ActionMagnet = { action: 'magnet' }
export type ActionMagnetResponse = { action: 'magnetResponse', key: string }
export type ActionGetEndGameJokersRequest = { action: 'getEndGameJokers' }
export type ActionReceiveEndGameJokersRequest = { action: 'receiveEndGameJokers', keys: string }
export type ActionGetNemesisDeckRequest = { action: 'getNemesisDeck' }
export type ActionReceiveNemesisDeckRequest = { action: 'receiveNemesisDeck', cards: string }
export type ActionStartAnteTimer = { action: 'startAnteTimer', time: number }
export type ActionPauseAnteTimer = { action: 'pauseAnteTimer', time: number }
export type ActionSetBossBlind = { action: 'setBossBlind'; bossKey: string; targetScore?: string};
export type ActionServerToClient =
	| ActionConnected
	| ActionError
	| ActionJoinedLobby
	| ActionLobbyInfo
	| ActionStopGame
	| ActionStartGame
	| ActionStartBlind
	| ActionWinGame
	| ActionLoseGame
	| ActionGameInfo
	| ActionGameStateUpdate
	| ActionEndPvP
	| ActionLobbyOptions
	| ActionRequestVersion
	| ActionUtility
	| ActionEnemyLocation
	| ActionSendPhantom
	| ActionRemovePhantom
	| ActionSpeedrun
	| ActionAsteroid
	| ActionLetsGoGamblingNemesis
	| ActionEatPizza
	| ActionSoldJoker
	| ActionSpentLastShop
	| ActionMagnet
	| ActionMagnetResponse
	| ActionGetEndGameJokersRequest
	| ActionReceiveEndGameJokersRequest
	| ActionGetNemesisDeckRequest
	| ActionReceiveNemesisDeckRequest
	| ActionStartAnteTimer
	| ActionPauseAnteTimer
	| ActionSetBossBlind

// Client to Server
export type ActionUsername = { action: 'username'; username: string; colour: string; modHash: string }
export type ActionCreateLobby = {
  action: "createLobby";
  ruleset: string;
  gameMode: GameMode;
};
export type ActionJoinLobby = { action: "joinLobby"; code: string };
export type ActionLeaveLobby = { action: "leaveLobby" };
export type ActionLobbyInfoRequest = { action: "lobbyInfo" };
export type ActionStopGameRequest = { action: "stopGame" };
export type ActionStartGameRequest = { action: "startGame" };
export type ActionReadyBlind = { action: "readyBlind" };
export type ActionUnreadyBlind = { action: "unreadyBlind" };
export type ActionPlayHand = {
  action: "playHand";
  score: string;
  hands_left: number;
  target_score?: string; // For coop survival mode
  hasSpeedrun: boolean;
};
export type ActionGameInfoRequest = { action: "gameInfo" };
export type ActionPlayerInfoRequest = { action: "playerInfo" };
export type ActionEnemyInfoRequest = { action: "enemyInfo" };
export type ActionFailRound = { action: "failRound" };
export type ActionSetAnte = {
  action: "setAnte";
  ante: number;
};
export type ActionVersion = { action: "version"; version: string };
export type ActionSetLocation = { action: "setLocation"; location: string };
export type ActionNewRound = { action: "newRound" };
export type ActionSetFurthestBlind = {
  action: "setFurthestBlind";
  furthest_blind: number;
};
export type ActionSkip = { action: "skip"; skips: number };
export type ActionLetsGoGamblingNemesisRequest = {
  action: "letsGoGamblingNemesis";
};
export type ActionEatPizzaRequest = { action: "eatPizza"; whole: boolean };
export type ActionSoldJokerRequest = { action: "soldJoker" };
export type ActionSpentLastShopRequest = {
  action: "spentLastShop";
  amount: number;
};
export type ActionMagnetRequest = { action: "magnet" };
export type ActionMagnetResponseRequest = {
  action: "magnetResponse";
  key: string;
};
export type ActionGetEndGameJokersResponse = { action: "getEndGameJokers" };
export type ActionReceiveEndGameJokersResponse = {
  action: "receiveEndGameJokers";
  keys: string;
};
export type ActionGetNemesisDeckResponse = { action: "getNemesisDeck" };
export type ActionReceiveNemesisDeckResponse = {
  action: "receiveNemesisDeck";
  cards: string;
};
export type ActionStartAnteTimerRequest = {
  action: "startAnteTimer";
  time: number;
};
export type ActionPauseAnteTimerRequest = {
  action: "pauseAnteTimer";
  time: number;
};
export type ActionFailTimer = { action: "failTimer" };
export type ActionSyncClient = { action: "syncClient"; isCached: boolean };
export type ActionClientToServer =
  | ActionUsername
  | ActionCreateLobby
  | ActionJoinLobby
  | ActionLeaveLobby
  | ActionLobbyInfoRequest
  | ActionStopGameRequest
  | ActionStartGameRequest
  | ActionReadyBlind
  | ActionPlayHand
  | ActionGameInfoRequest
  | ActionPlayerInfoRequest
  | ActionEnemyInfoRequest
  | ActionUnreadyBlind
  | ActionLobbyOptions
  | ActionFailRound
  | ActionSetAnte
  | ActionVersion
  | ActionSetLocation
  | ActionNewRound
  | ActionSetFurthestBlind
  | ActionSkip
  | ActionSendPhantom
  | ActionRemovePhantom
  | ActionAsteroid
  | ActionLetsGoGamblingNemesisRequest
  | ActionEatPizzaRequest
  | ActionSoldJokerRequest
  | ActionSpentLastShopRequest
  | ActionMagnetRequest
  | ActionMagnetResponseRequest
  | ActionGetEndGameJokersResponse
  | ActionReceiveEndGameJokersResponse
  | ActionGetNemesisDeckResponse
  | ActionReceiveNemesisDeckResponse
  | ActionStartAnteTimerRequest
  | ActionPauseAnteTimerRequest
  | ActionFailTimer
  | ActionSyncClient
  | ActionSetBossBlind;
// Utility actions
export type ActionKeepAlive = { action: "keepAlive" };
export type ActionKeepAliveAck = { action: "keepAliveAck" };

export type ActionUtility = ActionKeepAlive | ActionKeepAliveAck;

export type Action =
  | ActionServerToClient
  | ActionClientToServer
  | ActionUtility;

type HandledActions = ActionClientToServer | ActionUtility;
export type ActionHandlers = {
  [K in HandledActions["action"]]: keyof ActionHandlerArgs<
    Extract<HandledActions, { action: K }>
  > extends never
    ? (
        // biome-ignore lint/suspicious/noExplicitAny: Function can receive any arguments
        ...args: any[]
      ) => void
    : (
        action: ActionHandlerArgs<Extract<HandledActions, { action: K }>>,
        // biome-ignore lint/suspicious/noExplicitAny: Function can receive any arguments
        ...args: any[]
      ) => void;
};

export type ActionHandlerArgs<T extends HandledActions> = Omit<T, "action">;

// Other types
export type GameMode = "attrition" | "showdown" | "survival" | "coopSurvival";
