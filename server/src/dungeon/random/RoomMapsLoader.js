// Read each of the map data files in the map directory and load them.
const fs = require("fs");
const path = require("path");
const Utils = require("../../Utils");
const RoomMaps = require("./RoomMaps");
const RoomTypes = require("./RoomTypes");

const options = { encoding: "utf-8", withFileTypes: true };
const basePath = "map/dungeon/random";

const themeDirs = fs.readdirSync(basePath, options);

themeDirs.forEach((themeDir) => {
    console.log("themeDir:", themeDir.name);

    RoomMaps[themeDir.name] = {};

    const roomDirs = fs.readdirSync(`${basePath}/${themeDir.name}`, options);

    console.log("room dirs:", roomDirs);

    roomDirs.forEach((roomDir) => {
        console.log("roomDir:", roomDir);
        roomDir = path.parse(roomDir.name);
        console.log("parsed roomDir:", roomDir);

        if (roomDir.ext.toLowerCase() !== ".json") Utils.error(`Invalid random room map file extension for file "${roomDir.base}". Must be .JSON.`);

        if (!RoomTypes.includes(roomDir.name)) Utils.error(`Invalid random room map name for file "${roomDir.base}" . Valid names:`, RoomTypes);

        // Load the map data.
        // TODO
    });
});

console.log("loaded room maps");
