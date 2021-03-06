import PubSub from "pubsub-js";
import {
    CONNECTING, CONNECTED, JOINING, JOINED, LOADING, LOAD_ACCEPTED, WEBSOCKET_CLOSE, LOGGED_IN,
} from "../EventTypes";

class Application {
    constructor() {
        this.init();

        PubSub.subscribe(WEBSOCKET_CLOSE, () => {
            this.setConnected(false);
            this.setConnecting(false);
            this.setJoined(false);
        });
    }

    init() {
        this.connection = null;

        this.connecting = false;

        this.connected = false;

        this.joining = false;

        this.joined = false;

        this.joinWorldData = null;

        this.loading = false;

        this.loadAccepted = true;

        this.loggedIn = false;

        this.missedWebsocketEvents = [];

        this.maxDisplayNameLength = 0;

        this.maxUsernameLength = 0;

        this.displayNameChangeCost = 0;
    }

    setConnecting(value) {
        const old = this.connecting;
        this.connecting = value;
        PubSub.publish(CONNECTING, { old, new: this.connecting });
    }

    setConnected(value) {
        const old = this.connected;
        this.connected = value;
        PubSub.publish(CONNECTED, { old, new: this.connected });

        if (value) {
            this.setConnecting(false);
        }
        else {
            this.setLoading(false);
            this.setLoadAccepted(true);
        }
    }

    setJoining(value) {
        const old = this.joining;
        this.joining = value;
        PubSub.publish(JOINING, { old, new: this.joining });
    }

    setJoined(value) {
        const old = this.joined;
        this.joined = value;
        PubSub.publish(JOINED, { old, new: this.joined });

        if (value) {
            this.setJoining(false);
        }
    }

    setLoading(value) {
        const old = this.loading;
        this.loading = value;
        PubSub.publish(LOADING, { old, new: this.loading });

        // When loading again, make sure the loading page gets shown.
        if (value) {
            this.setLoadAccepted(false);
        }
    }

    setLoadAccepted(value) {
        const old = this.loadAccepted;
        this.loadAccepted = value;
        PubSub.publish(LOAD_ACCEPTED, { old, new: this.loadAccepted });
    }

    setLoggedIn(value) {
        const old = this.loggedIn;
        this.loggedIn = value || false;
        PubSub.publish(LOGGED_IN, { old, new: this.loggedIn });
    }

    addMissedWebsocketEvent(eventName, parsedData) {
        this.missedWebsocketEvents.push({
            eventName,
            parsedData,
        });
    }
}

export default Application;
