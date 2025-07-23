import { Socket, type AddressInfo } from 'node:net'
import { v4 as uuidv4 } from 'uuid'
import type Lobby from './Lobby.js'
import type { ActionServerToClient } from './actions.js'
import { InsaneInt } from './InsaneInt.js'
import { KeepAliveTimer } from './KeepAliveTimer.js'

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
  ante: number
  furthest_blind: number
  hands_left: number
  hands_max: number
  discards_left: number
  discards_max: number
  highest_score: InsaneInt
  lives: number
  lives_blocker: boolean
  location: string
  score: InsaneInt
  skips: number
  spent_in_shop: number[]
}

class Client {
  id: string = uuidv4();
  address: Address;
  keepAliveTimer: KeepAliveTimer;
  socket: Socket;
  lobby: Lobby | null = null;
  lobbyData: LobbyData = {
    username: "Guest",
    colour: "1",
    modHash: "NULL",
    isCached: true,
    isReady: false,
    firstReady: false,
  };
  gameState: GameStateData;

  onLoseGame: (client: Client) => void = () => {}

  constructor(socket: Socket) {
    this.socket = socket;
    this.address = socket.address() as Address;
    // Initial state
    const initialState: GameStateData = {
      ante: 1,
      discards_left: 2,
      discards_max: 2,
      furthest_blind: 0,
      hands_left: 4,
      hands_max: 4,
      highest_score: new InsaneInt(0, 0, 0),
      lives: 4,
      lives_blocker: false,
      location: "loc_selecting",
      score: new InsaneInt(0, 0, 0),
      skips: 0,
      spent_in_shop: [],
    };
    this.gameState = new Proxy(initialState, {
      set: (target, prop: keyof GameStateData, value) => {
        (target as any)[prop as string] = value;
        this.broadcastStateUpdate([prop as keyof GameStateData]);
        return true;
      },
    });
    this.keepAliveTimer = new KeepAliveTimer(
      () => this.sendAction({ action: "keepAlive" }),
      () => this.closeConnection()
    );
    this.keepAliveTimer.start();
  }

  closeConnection(): void {
    if (this.lobby) this.lobby.leave(this);
    if (!this.socket || this.socket.destroyed) return;
    this.socket.end();
    this.socket.destroy();
  }

  sendAction(action: ActionServerToClient): void {
    if (!this.socket || this.socket.destroyed || !this.socket.writable) return;
    const data = JSON.stringify(action);
    if (action.action !== "keepAlive" && action.action !== "keepAliveAck") {
      console.log(
        `[${new Date().toISOString()}] \x1b[31mSent action "${
          action.action
        }" to client ${this.id}\x1b[0m`,
        { ...action }
      );
    }
    this.socket.write(`${data}\n`);
  }

  resetState(): void {
    const state = this.gameState;
    state.ante = 1;
    state.discards_left = 2;
    state.discards_max = 2;
    state.furthest_blind = 0;
    state.hands_left = 4;
    state.hands_max = 4;
    state.highest_score = new InsaneInt(0, 0, 0);
    state.lives = 4;
    state.lives_blocker = false;
    state.location = "loc_selecting";
    state.score = new InsaneInt(0, 0, 0);
    state.skips = 0;
    state.spent_in_shop = [];
    this.lobbyData.isReady = false;
  }

  loseLives(livesLost: number = 1): void {
    if (this.gameState.lives_blocker) return;

    const newLives = this.gameState.lives - livesLost;
    this.setGameStateValues({
      lives: newLives,
    });

    if (newLives <= 0) {
      this.onLoseGame(this)
      return;
    }
  }

  setGameStateValues(updates: Partial<GameStateData>): void {
    for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        // @ts-expect-error: dynamic assignment
        this.gameState[key] = updates[key];
      }
    }
  }

  broadcastStateUpdate(keys: (keyof GameStateData)[]): void {
    if (!this.lobby) return;
    const updates: Record<string, unknown> = {};
    for (const key of keys) updates[key] = this.gameState[key];
    this.lobby.players.forEach((player: Client) => {
      player.sendAction({
        action: "gameStateUpdate",
        id: this.id,
        updates,
      });
    });
  }
}

export default Client;
