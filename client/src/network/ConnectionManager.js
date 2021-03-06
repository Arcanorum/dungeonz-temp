import PubSub from "pubsub-js";
import EventNames from "../catalogues/EventNames.json";
import eventResponses from "./websocket_events/EventResponses";
import { ApplicationState } from "../shared/state/States";
import { WEBSOCKET_CLOSE, WEBSOCKET_ERROR } from "../shared/EventTypes";
import Utils from "../shared/Utils";
import dungeonz from "../shared/Global";

export const ConnectionCloseTypes = {
    // No connection made yet. User has no internet access.
    CANNOT_CONNECT_NO_INTERNET: Symbol("CANNOT_CONNECT_NO_INTERNET"),
    // No connection made yet. Connection can't be made to server.
    CANNOT_CONNECT_NO_SERVER: Symbol("CANNOT_CONNECT_NO_SERVER"),
    // Already connected. User lost internet access.
    DISCONNECTED_NO_INTERNET: Symbol("DISCONNECTED_NO_INTERNET"),
    // Already connected. Server crashed or something.
    DISCONNECTED_NO_SERVER: Symbol("DISCONNECTED_NO_SERVER"),
};

const getErrorCategory = () => {
    if (ApplicationState.connected) {
        if (window.navigator.onLine) {
            // Something happened to the connection, probably server related.
            return ConnectionCloseTypes.DISCONNECTED_NO_SERVER;
        }

        // Lost internet connection.
        return ConnectionCloseTypes.DISCONNECTED_NO_INTERNET;
    }

    // Not connected yet.
    if (window.navigator.onLine) {
        // Something wrong creating the connection, probably server related.
        return ConnectionCloseTypes.CANNOT_CONNECT_NO_SERVER;
    }

    // No internet connection.
    return ConnectionCloseTypes.CANNOT_CONNECT_NO_INTERNET;
};

/**
 * Attempt to create a new websocket connection to the game server.
 * @returns {Boolean} Whether a the function finished without a problem.
 */
export const connectToGameServer = () => {
    // If the game is running in dev mode (localhost), connect without SSL.
    if (dungeonz.host === "local") {
        const serverBaseURL = "127.0.0.1:4567";
        ApplicationState.httpServerURL = `http://${serverBaseURL}`;
        ApplicationState.websocketServerURL = `ws://${serverBaseURL}`;
    }
    else if (dungeonz.host === "test") {
        // Test mode. Connect to public test server, which should be using SSL.
        const serverBaseURL = "test.dungeonz.io:443";
        ApplicationState.httpServerURL = `https://${serverBaseURL}`;
        ApplicationState.websocketServerURL = `wss://${serverBaseURL}`;
    }
    else {
        // Deployment mode. Connect to live server, which should be using SSL.
        const serverBaseURL = "dungeonz.io:443";
        ApplicationState.httpServerURL = `https://${serverBaseURL}`;
        ApplicationState.websocketServerURL = `wss://${serverBaseURL}`;
    }

    if (ApplicationState.connected || ApplicationState.connecting) {
        return false;
    }

    // Connect to the game server.
    ApplicationState.connection = new WebSocket(ApplicationState.websocketServerURL);

    ApplicationState.setConnecting(true);

    /**
     * Event emit helper. Attach this to a socket, and use it to send an event to the server.
     * @param {String} eventName
     * @param {Object} [data]
     */
    ApplicationState.connection.sendEvent = (eventName, data) => {
        ApplicationState.connection.send(JSON.stringify({ eventName, data }));
    };

    // Wait for the connection to have finished opening before attempting to join the world.
    ApplicationState.connection.onopen = () => {
        ApplicationState.setConnected(true);
    };

    ApplicationState.connection.onmessage = (event) => {
        // The data is JSON, so parse it.
        const parsedMessage = JSON.parse(event.data);
        // Every event received should have an event name ID, which is a number that represents an event name string.
        // Numbers are smaller, so saves sending lengthy strings for each message.
        const { eventNameID } = parsedMessage;
        // Look up the corresponding event name string for the given ID.
        const eventName = EventNames[eventNameID];
        // Check this event name ID is in the list of valid event name IDs.
        if (eventName !== undefined) {
            // Check there is a response function to run for the event.
            if (eventResponses[eventName] !== undefined) {
                // Run the response, giving it any data.
                // Need to check for if any data was given at all, otherwise falsy values
                // like 0 and false would be ignored, even though they are valid values.
                if (parsedMessage.data === undefined) {
                    eventResponses[eventName]({});
                }
                else {
                    eventResponses[eventName](parsedMessage.data);
                }
            }
            // Event response is missing. It might have not been added yet (game state still
            // loading), so store it for now so this missed event can be re-ran when they have
            // finished loading (and the game event responses are added) so they can be
            // fastforwarded to the current game world state.
            else if (parsedMessage.data === undefined) {
                ApplicationState.addMissedWebsocketEvent(eventName, {});
            }
            else {
                ApplicationState.addMissedWebsocketEvent(eventName, parsedMessage.data);
            }
        }
    };

    ApplicationState.connection.onclose = () => {
        Utils.message("Disconnected from game server.");

        ApplicationState.connection = null;

        // Do this first, otherwise the current state is lost and can't tell if it
        // was initial connection failure, or failure while already connected.
        PubSub.publish(WEBSOCKET_CLOSE, getErrorCategory());

        ApplicationState.setJoined(false);
        ApplicationState.setJoining(false);
        ApplicationState.setConnected(false);
        ApplicationState.setConnecting(false);
    };

    ApplicationState.connection.onerror = (error) => {
        Utils.message("Websocket error:", error);

        PubSub.publish(WEBSOCKET_ERROR, error);
    };

    return true;
};

export const joinGameNewCharacter = (characterName) => {
    ApplicationState.connection.sendEvent("new_char", { displayName: characterName });

    ApplicationState.setJoining(true);
};

export const joinGameContinue = async (username, password) => {
    // Check username and password are valid.
    if (username === "") return;
    if (password === "") return;

    // Encrypt the password before sending.
    const hash = await Utils.digestMessage(password);

    ApplicationState.connection.sendEvent("log_in", {
        username,
        password: hash,
    });

    ApplicationState.setJoining(true);
};
