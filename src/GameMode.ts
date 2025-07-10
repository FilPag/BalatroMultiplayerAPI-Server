import type { GameMode } from "./actions.js";
import { LobbyOptions } from "./Lobby.js";

type GameModeData = {

  defaultOptions: LobbyOptions

  getBlindFromAnte: (
    ante: number,
    options: any,
  ) => {
    small?: string;
    big?: string;
    boss?: string;
  };

  // TODO: Validate lobby options when they differ per gamemode
};

const GameModes: {
  [key in GameMode]: GameModeData;
} = {
  attrition: {
    defaultOptions: {
      back: "Red Deck",
      challenge: 0,
      custom_seed: "random",
      death_on_round_loss: false,
      different_decks: false,
      different_seeds: false,
      disable_live_and_timer_hud: false,
      gamemode: "gamemode_mp_attrition",
      gold_on_life_loss: true,
      multiplayer_jokers: true,
      no_gold_on_round_loss: false,
      normal_bosses: false,
      pvp_start_round: 2,
      ruleset: "ruleset_mp_standard",
      showdown_starting_antes: 3,
      sleeve: "sleeve_casl_none",
      stake: 1,
      starting_lives: 4,
      timer_base_seconds: 150,
      timer_increment_seconds: 60,
    },
    getBlindFromAnte: (ante, options) => {
      return { boss: "bl_pvp" };
    },
  },
  showdown: {
    defaultOptions: {
      back: "Red Deck",
      challenge: 0,
      custom_seed: "random",
      death_on_round_loss: false,
      different_decks: false,
      different_seeds: false,
      disable_live_and_timer_hud: false,
      gamemode: "gamemode_mp_showdown",
      gold_on_life_loss: true,
      multiplayer_jokers: true,
      no_gold_on_round_loss: false,
      normal_bosses: false,
      pvp_start_round: 2,
      ruleset: "ruleset_mp_standard",
      showdown_starting_antes: 3,
      sleeve: "sleeve_casl_none",
      stake: 1,
      starting_lives: 4,
      timer_base_seconds: 150,
      timer_increment_seconds: 60,
    },
    getBlindFromAnte: (ante, options) => {
      const starting_antes = options?.showdown_starting_antes
        ? parseInt(options.showdown_starting_antes)
        : 3;
      if (ante <= starting_antes) return {};
      else return { small: "bl_pvp", big: "bl_pvp", boss: "bl_pvp" };
    },
  },
  survival: {
    defaultOptions: {
      back: "Red Deck",
      challenge: 0,
      custom_seed: "random",
      death_on_round_loss: false,
      different_decks: false,
      different_seeds: false,
      disable_live_and_timer_hud: false,
      gamemode: "gamemode_mp_survival",
      gold_on_life_loss: true,
      multiplayer_jokers: true,
      no_gold_on_round_loss: false,
      normal_bosses: false,
      pvp_start_round: 20,
      ruleset: "ruleset_mp_standard",
      showdown_starting_antes: 3,
      sleeve: "sleeve_casl_none",
      stake: 1,
      starting_lives: 4,
      timer_base_seconds: 150,
      timer_increment_seconds: 60,
    },
    getBlindFromAnte: (ante, options) => {
      return {};
    },
  },
  coopSurvival: {
    defaultOptions: {
      back: "Red Deck",
      challenge: 0,
      custom_seed: "random",
      death_on_round_loss: false,
      different_decks: true,
      different_seeds: true,
      disable_live_and_timer_hud: false,
      gamemode: "gamemode_mp_coopSurvival",
      ruleset: "ruleset_mp_coop",
      gold_on_life_loss: true,
      multiplayer_jokers: false,
      no_gold_on_round_loss: false,
      normal_bosses: true,
      pvp_start_round: 2,
      showdown_starting_antes: 3,
      sleeve: "sleeve_casl_none",
      stake: 1,
      starting_lives: 2,
      timer_base_seconds: 150,
      timer_increment_seconds: 60,
    },
    getBlindFromAnte: (ante, options) => {
      return {};
    },
  },
};

export default GameModes;
