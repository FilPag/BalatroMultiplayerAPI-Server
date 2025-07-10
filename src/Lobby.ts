import type Client from "./Client.js";
import GameModes from "./GameMode.js";
import { InsaneInt } from "./InsaneInt.js";
import type {
	ActionLobbyInfo,
	ActionLobbyOptions,
	ActionServerToClient,
	GameMode,
} from "./actions.js";

export type LobbyOptions = {
	back: string;
	challenge: number;
	custom_seed: string;
	death_on_round_loss: boolean;
	disable_live_and_timer_hud: boolean;
	different_decks: boolean;
	different_seeds: boolean;
	gamemode: string;
	gold_on_life_loss: boolean;
	multiplayer_jokers: boolean;
	no_gold_on_round_loss: boolean;
	normal_bosses: boolean;
	pvp_start_round: number;
	ruleset: string;
	showdown_starting_antes: number;
	sleeve: string;
	stake: number;
	starting_lives: number;
	timer_base_seconds: number;
	timer_increment_seconds: number;
};

const Lobbies = new Map();

const generateUniqueLobbyCode = (): string => {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for (let i = 0; i < 5; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return Lobbies.get(result) ? generateUniqueLobbyCode() : result;
};

export const getHostID = (client: Client): string => {
	const lobby = client.lobby;
	if (!lobby) return "";

	const host = lobby.players[lobby.hostIndex];

	if (host == undefined) {
		console.error("Host not found in lobby", lobby.code)
		return ""
	}
	return host.id;
}

export const getOtherPlayers = (client: Client): [Lobby | null, Client[]] => {
	const lobby = client.lobby;
	if (!lobby) return [null, []];
	const others = lobby.players.filter(p => p.id !== client.id);
	return [lobby, others];
};

class Lobby {
	code: string;
	players: Client[];
	hostIndex: number;
	gameMode: GameMode;
	// biome-ignore lint/suspicious/noExplicitAny: 
	options: LobbyOptions;
	maxPlayers: number;

	constructor(host: Client, ruleset: string, gameMode: GameMode = "attrition", maxPlayers?: number) {
		do {
			this.code = generateUniqueLobbyCode();
		} while (Lobbies.get(this.code));
		Lobbies.set(this.code, this);

		this.gameMode = gameMode;
		this.hostIndex = 0;
		this.options = GameModes[gameMode].defaultOptions;
		this.options.ruleset = ruleset;
		this.players = [host];

		switch(ruleset){
			case "standard":
				this.options.multiplayer_jokers = true;
				break;
			case "vanilla":
				this.options.multiplayer_jokers = false;
				break;
			case "badlatro":
				this.options.multiplayer_jokers = true;
				break;
			default:
			case "coop":
				this.options.multiplayer_jokers = false;
		}

		// Set maxPlayers based on gamemode
		if (typeof maxPlayers === 'number') {
			this.maxPlayers = maxPlayers;
		} else if (gameMode === 'coopSurvival') {
			this.maxPlayers = 8; // Allow up to 8 in coop
		} else {
			this.maxPlayers = 2; // All other modes limited to 2
		}

		host.setLobby(this);
		host.sendAction({
			action: "joinedLobby",
			code: this.code,
		});
		host.sendAction({ action: "lobbyOptions", options: this.options });
	}

	static get = (code: string) => {
		return Lobbies.get(code);
	};

	leave = (client: Client) => {
		const idx = this.players.findIndex(p => p.id === client.id);
		if (idx !== -1) {
			this.players.splice(idx, 1);
			if (this.hostIndex === idx) {
				// Host left, assign new host if possible
				this.hostIndex = this.players.length > 0 ? 0 : -1;
			}
		}
		client.setLobby(null);
		if (this.players.length === 0) {
			Lobbies.delete(this.code);
		} else {
			this.broadcastAction({ action: "stopGame" });
			this.resetPlayers();
			this.broadcastLobbyInfo();
		}
	};

	join = (client: Client) => {
		if (this.players.length >= this.maxPlayers) {
			client.sendAction({
				action: "error",
				message: "Lobby is full or does not exist.",
			});
			return;
		}
		this.players.push(client);
		client.setLobby(this);
		client.sendAction({
			action: "joinedLobby",
			code: this.code,
		});
		this.broadcastLobbyInfo();
		client.sendAction({ action: "lobbyOptions", options: this.options });
	};

	broadcastAction = (action: ActionServerToClient) => {
		this.players.forEach(player => player.sendAction(action));
	};

	broadcastLobbyInfo = () => {
		if (this.players.length === 0) return;

		this.players.forEach((player, idx) => {
			const action: ActionLobbyInfo = {
				action: "lobbyInfo",
				host: this.players[this.hostIndex]?.lobbyData?.username || "",
				isHost: idx === this.hostIndex,
				local_id: player.id,
				players: this.players.map(p => ({
					id: p.id,
					...p.lobbyData
				}))
			};
			player.sendAction(action);
		});
	};

	sendGameInfo = (client: Client) => {
		if (!this.players.some(p => p === client)) {
			return client.sendAction({
				action: "error",
				message: "Client not in Lobby",
			});
		}
		client.sendAction({
			action: "gameInfo",
			...GameModes[this.gameMode].getBlindFromAnte(client.ante, this.options),
		});
	};

	setOptions = (options: LobbyOptions) => {
		this.options = options;
		this.players.forEach(player => player.sendAction({ action: "lobbyOptions", options: this.options }));
	};

	resetPlayers = () => {
		this.players.forEach(player => {
			player.lobbyData.isReady = false;
			player.resetBlocker();
			player.location = "Blind Select";
			player.furthest_blind = 0;
			player.skips = 0;
		});
	}

	setPlayersLives = (lives: number) => {
		this.players.forEach(player => {
			player.lives = lives;
		});
	}
}

export default Lobby;
