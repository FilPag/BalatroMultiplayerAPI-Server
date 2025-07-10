import { Socket, type AddressInfo } from 'node:net'
import { v4 as uuidv4 } from 'uuid'
import type Lobby from './Lobby.js'
import type { ActionServerToClient } from './actions.js'
import { InsaneInt } from './InsaneInt.js'
import { KeepAliveTimer } from './KeepAliveTimer.js'

type SendFn = (action: ActionServerToClient) => void
type CloseConnFn = () => void

/* biome-ignore lint/complexity/noBannedTypes: 
  This is how the net module does it */
type Address = AddressInfo | {}

export type LobbyData = {
  username: string
  colour: string
  modHash: string
  isCached: boolean
  isReady: boolean
  firstReady: boolean
}

// Must be snake case since this is sent to the client which uses snake case
export type GameStateData = {
  lives: number
  score: InsaneInt
  highest_score: InsaneInt
  hands_left: number
  ante: number
  skips: number
  furthest_blind: number
  lives_blocker: boolean
  location: string
}

class Client {
  // Connection info
  id: string;
  address: Address;
  keepAliveTimer: KeepAliveTimer;
  private socket: Socket | null = null;

  // Game info
  lobby: Lobby | null = null;

  lobbyData: LobbyData = {
    username: "Guest",
    colour: "1",
    modHash: "NULL",
    isCached: true,
    isReady: false,
    firstReady: false,
  };

  gameState: GameStateData = {
    lives: 4,
    score: new InsaneInt(0, 0, 0),
    highest_score: new InsaneInt(0, 0, 0),
    hands_left: 4,
    ante: 1,
    skips: 0,
    furthest_blind: 0,
    lives_blocker: false,
    location: "loc_selecting",
  };

  closeConnection: CloseConnFn = () => {
    if (this.lobby) this.lobby.leave(this);
    if (!this.socket) return;

    if (this.socket.destroyed) return;
    this.socket.end();
    this.socket.destroy();
  };

  sendAction: SendFn = (action) => {
    if (!this.socket) return;
    if (this.socket.destroyed || !this.socket.writable) return;

    const data = JSON.stringify(action);

    const { action: actionName, ...actionArgs } = action;

    if (actionName !== "keepAlive" && actionName !== "keepAliveAck") {
      console.log(
        `[${new Date().toISOString()}] \x1b[31mSent action "${actionName}" to client ${
          this.id
        }\x1b[0m`,
        actionArgs
      );
    }
    this.socket.write(`${data}\n`);
  };

  public resetState = () => {
    this.gameState = {
      lives: 4,
      score: new InsaneInt(0, 0, 0),
      highest_score: new InsaneInt(0, 0, 0),
      hands_left: 4,
      ante: 1,
      skips: 0,
      furthest_blind: 0,
      lives_blocker: false,
      location: "loc_selecting",
    };
  };

  constructor(socket: Socket) {
    this.id = uuidv4();
    this.socket = socket;
    this.address = socket.address() as Address;
    this.keepAliveTimer = new KeepAliveTimer(
      () => this.sendAction({ action: "keepAlive" }),
      this.closeConnection
    );
    this.keepAliveTimer.start();
  }

  // Getters for backward compatibility and easier access
  get username() {
    return this.lobbyData.username;
  }
  get colour() {
    return this.lobbyData.colour;
  }
  get modHash() {
    return this.lobbyData.modHash;
  }
  get isCached() {
    return this.lobbyData.isCached;
  }
  set isCached(value: boolean) {
    this.lobbyData.isCached = value;
  }
  get isReady() {
    return this.lobbyData.isReady;
  }
  set isReady(value: boolean) {
    this.lobbyData.isReady = value;
  }
  get firstReady() {
    return this.lobbyData.firstReady;
  }
  set firstReady(value: boolean) {
    this.lobbyData.firstReady = value;
  }

  get lives() {
    return this.gameState.lives;
  }
  set lives(value: number) {
    this.gameState.lives = value;
  }
  get score() {
    return this.gameState.score;
  }
  set score(value: InsaneInt) {
    this.gameState.score = value;
  }
  get highest_score() {
    return this.gameState.highest_score;
  }
  set highest_score(value: InsaneInt) {
    this.gameState.highest_score = value;
  }
  get hands_left() {
    return this.gameState.hands_left;
  }
  set hands_left(value: number) {
    this.gameState.hands_left = value;
  }
  get ante() {
    return this.gameState.ante;
  }
  set ante(value: number) {
    this.gameState.ante = value;
  }
  get skips() {
    return this.gameState.skips;
  }
  set skips(value: number) {
    this.gameState.skips = value;
  }
  get furthest_blind() {
    return this.gameState.furthest_blind;
  }
  set furthest_blind(value: number) {
    this.gameState.furthest_blind = value;
  }
  get lives_blocker() {
    return this.gameState.lives_blocker;
  }
  set lives_blocker(value: boolean) {
    this.gameState.lives_blocker = value;
  }
  get location() {
    return this.gameState.location;
  }
  set location(value: string) {
    this.gameState.location = value;
  }

  setLocation = (location: string) => {
    this.location = location;
    this.broadcastStateUpdate({ location });
  };

  setUsername = (username: string) => {
    this.lobbyData.username = username;
    this.lobby?.broadcastLobbyInfo();
  };

  setColour = (colour: string) => {
    this.lobbyData.colour = colour;
    this.lobby?.broadcastLobbyInfo();
  };

  setModHash = (modHash: string) => {
    this.lobbyData.modHash = modHash;
    this.lobby?.broadcastLobbyInfo();
  };

  setLobby = (lobby: Lobby | null) => {
    this.lobby = lobby;
  };

  resetBlocker = () => {
    this.lives_blocker = false;
  };

  loseLife = (skipblocker: boolean = false) => {
    if (!this.lives_blocker || skipblocker) {
      this.lives -= 1;
      this.lives_blocker = true;

      // Broadcast state update to others
      this.broadcastStateUpdate({
        lives: this.lives,
        lives_blocker: this.lives_blocker,
      });
    }
  };

  setSkips = (skips: number) => {
    this.skips = skips;
  };

  // Helper method to broadcast game state updates
  broadcastStateUpdate = (
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
  ) => {
    if (!this.lobby) return;

    this.lobby.players.forEach((player) => {
      player.sendAction({
        action: "gameStateUpdate",
        id: this.id,
        updates,
      });
    });
  };
}

export default Client;
