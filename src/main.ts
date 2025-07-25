import { Socket, createServer } from 'node:net'
import Client from './Client.js'
import { actionHandlers } from './actionHandlers.js'
import type {
  Action,
  ActionClientToServer,
  ActionCreateLobby,
  ActionEatPizza,
  ActionHandlerArgs,
  ActionJoinLobby,
  ActionLobbyOptions,
  ActionMagnet,
  ActionMagnetResponse,
  ActionPlayHand,
  ActionReceiveEndGameJokersRequest,
  ActionRemovePhantom,
  ActionSendPhantom,
  ActionServerToClient,
  ActionSetAnte,
  ActionSetLocation,
  ActionSkip,
  ActionSpentLastShop,
  ActionStartAnteTimer,
  ActionPauseAnteTimer,
  ActionSyncClient,
  ActionUsername,
  ActionUtility,
  ActionVersion,
  ActionReceiveNemesisStatsRequest,
  ActionSetBossBlind,
  ActionSetFurthestBlind,
  ActionSendPlayerDeck,
  ActionSetLobbyReady,
  ActionClientGameStateUpdate,
} from './actions.js'

const PORT = 8788


interface BigIntWithToJSON {
  prototype: {
    toJSON: () => string
  }
}

(BigInt as unknown as BigIntWithToJSON).prototype.toJSON = function () {
  return this.toString();
};
/** Serializes an action for transmission to the client */
export const serializeAction = (action: Action): string => {
  const entries = Object.entries(action)
  const parts = entries
    .filter(([_key, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}:${value}`)
  return parts.join(',')
}


const server = createServer((socket) => {
  socket.allowHalfOpen = false;
  // Do not wait for packets to buffer, helps
  // improve latency between responses
  socket.setNoDelay();

  const client = new Client(socket);
  client.sendAction({ action: "connected" });
  client.sendAction({ action: "version" });

  socket.on("data", async (data) => {
    // Data received, reset keepAlive
    client.keepAliveTimer.refresh();

    const messages = data.toString().split("\n");

    // Process all messages in parallel for higher throughput
    await Promise.all(messages.filter(Boolean).map(async (msg) => {
      try {
        const message: ActionClientToServer | ActionUtility = JSON.parse(msg);
        const { action, ...actionArgs } = message;

        if (action !== "keepAlive" && action !== "keepAliveAck") {
          setImmediate(() => {
            /*console.log(
              `[${new Date().toISOString()}] \x1b[36mReceived action "${action}" from client ${
                client.id
              }\x1b[0m`,
              actionArgs
            );*/
          });
        }

        // Await all actionHandlers for non-blocking IO
        switch (action) {
          case "setLocation":
            await actionHandlers.setLocation(
              actionArgs as ActionHandlerArgs<ActionSetLocation>,
              client
            );
            break;
          case "version":
            await actionHandlers.version(
              actionArgs as ActionHandlerArgs<ActionVersion>,
              client
            );
            break;
          case "username":
            await actionHandlers.username(
              actionArgs as ActionHandlerArgs<ActionUsername>,
              client
            );
            break;
          case "createLobby":
            await actionHandlers.createLobby(
              actionArgs as ActionHandlerArgs<ActionCreateLobby>,
              client
            );
            break;
          case "joinLobby":
            await actionHandlers.joinLobby(
              actionArgs as ActionHandlerArgs<ActionJoinLobby>,
              client
            );
            break;
          case "lobbyInfo":
            await actionHandlers.lobbyInfo(client);
            break;
          case "leaveLobby":
            await actionHandlers.leaveLobby(client);
            break;
          case "startGame":
            await actionHandlers.startGame(client);
            break;
          case "setLobbyReady":
            await actionHandlers.setLobbyReady(
              actionArgs as ActionHandlerArgs<ActionSetLobbyReady>,
              client
            );
            break;
          case "readyBlind":
            await actionHandlers.readyBlind(client);
            break;
          case "unreadyBlind":
            await actionHandlers.unreadyBlind(client);
            break;
          case "keepAlive":
            await actionHandlers.keepAlive(client);
            break;
          case "playHand":
            await actionHandlers.playHand(
              actionArgs as ActionHandlerArgs<ActionPlayHand>,
              client
            );
            break;
          case "stopGame":
            await actionHandlers.stopGame(client);
            break;
          case "lobbyOptions":
            await actionHandlers.lobbyOptions(
              actionArgs as ActionHandlerArgs<ActionLobbyOptions>,
              client
            );
            break;
          case "newRound":
            await actionHandlers.newRound(client);
            break;
          case "failRound":
            await actionHandlers.failRound(client);
            break;
          case "setAnte":
            await actionHandlers.setAnte(
              actionArgs as ActionHandlerArgs<ActionSetAnte>,
              client
            );
            break;
          case "setFurthestBlind":
            await actionHandlers.setFurthestBlind(
              actionArgs as ActionHandlerArgs<ActionSetFurthestBlind>,
              client
            );
            break;
          case "skip":
            await actionHandlers.skip(
              actionArgs as ActionHandlerArgs<ActionSkip>,
              client
            );
            break;
          case "setBossBlind":
            await actionHandlers.setBossBlind(
              actionArgs as ActionHandlerArgs<ActionSetBossBlind>,
              client
            );
            break;
          case "sendPhantom":
            await actionHandlers.sendPhantom(
              actionArgs as ActionHandlerArgs<ActionSendPhantom>,
              client
            );
            break;
          case "removePhantom":
            await actionHandlers.removePhantom(
              actionArgs as ActionHandlerArgs<ActionRemovePhantom>,
              client
            );
            break;
          case "asteroid":
            await actionHandlers.asteroid(client);
            break;
          case "letsGoGamblingNemesis":
            await actionHandlers.letsGoGamblingNemesis(client);
            break;
          case "eatPizza":
            await actionHandlers.eatPizza(
              actionArgs as ActionHandlerArgs<ActionEatPizza>,
              client
            );
            break;
          case "soldJoker":
            await actionHandlers.soldJoker(client);
            break;
          case "spentLastShop":
            await actionHandlers.spentLastShop(
              actionArgs as ActionHandlerArgs<ActionSpentLastShop>,
              client
            );
            break;
          case "magnet":
            await actionHandlers.magnet(client);
            break;
          case "magnetResponse":
            await actionHandlers.magnetResponse(
              actionArgs as ActionHandlerArgs<ActionMagnetResponse>,
              client
            );
            break;
          case "getEndGameJokers":
            await actionHandlers.getEndGameJokers(client);
            break;
          case "receiveEndGameJokers":
            await actionHandlers.receiveEndGameJokers(
              actionArgs as ActionHandlerArgs<ActionReceiveEndGameJokersRequest>,
              client
            );
            break;
          case "sendPlayerDeck":
            await actionHandlers.sendPlayerDeck(
              actionArgs as ActionHandlerArgs<ActionSendPlayerDeck>,
              client
            );
            break;
          case "startAnteTimer":
            await actionHandlers.startAnteTimer(
              actionArgs as ActionHandlerArgs<ActionStartAnteTimer>,
              client
            );
            break;
          case "pauseAnteTimer":
            await actionHandlers.pauseAnteTimer(
              actionArgs as ActionHandlerArgs<ActionPauseAnteTimer>,
              client
            );
            break;
          case "failTimer":
            await actionHandlers.failTimer(client);
            break;
          case "syncClient":
            await actionHandlers.syncClient(
              actionArgs as ActionHandlerArgs<ActionSyncClient>,
              client
            );
            break;
          case "endGameStatsRequested":
            await actionHandlers.endGameStatsRequested(client);
            break;
          case "nemesisEndGameStats":
            await actionHandlers.nemesisEndGameStats(
              actionArgs as ActionHandlerArgs<ActionReceiveNemesisStatsRequest>,
              client
            );
            break;
          case "updatePlayerGameState":
            await actionHandlers.updatePlayerGameState(
              actionArgs as ActionHandlerArgs<ActionClientGameStateUpdate>,
              client
            );
            break;
        }
      } catch (error) {
        const failedToParseError = "Failed to parse message";
        /*console.error(failedToParseError, error);*/
        client.sendAction({
          action: "error",
          message: failedToParseError,
        });
      }
    }));
  });

  socket.on("end", () => {
    console.log(`Client disconnected ${client.id}`);
    actionHandlers.leaveLobby?.(client);
  });

  socket.on(
    "error",
    (
      err: Error & {
        errno: number;
        code: string;
        syscall: string;
      }
    ) => {
      if (err.code === "ECONNRESET") {
        console.warn("TCP connection reset by peer (client).");
      } else {
        console.error("An unexpected error occurred:", err);
      }
      actionHandlers.leaveLobby?.(client);
    }
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
