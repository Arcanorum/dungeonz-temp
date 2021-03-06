import Phaser from "phaser";
import Boot from "../../game/Boot";
import Game from "../../game/Game";
import dungeonz from "../../shared/Global";

/**
 * @type {Phaser.Scene}
 * A global reference to the currently running Phaser scene.
 */
dungeonz.gameScene = {};

export default () => {
    const config = {
        type: Phaser.WEBGL,
        parent: "game-canvas",
        width: 100,
        height: 100,
        pixelArt: true,
        antialias: false,
        antialiasGL: false,
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            fullscreenTarget: "game-cont",
        },
        scene: [
            Boot,
            Game,
        ],
    };

    const game = new Phaser.Game(config);

    game.events.on("destroy", () => {
        dungeonz.gameScene = {};
    });

    return game;
};
