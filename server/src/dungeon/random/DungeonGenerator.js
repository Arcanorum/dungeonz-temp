// Start at floor 1
// Start with empty map

const RoomMaps = require("./RoomMaps");

// Randomly pick new direction for next room
// Randomly pick next room type
// Add room area to map so far from room type map data
// Map files to emit to players on join

class Room {
    constructor({
        singleInstance = false,
    }) {
        this.singleInstance = singleInstance;
        this.mapData = null;
    }
}

class ThemeRooms {
    constructor() {
        this.start = new Room({ singleInstance: true });
        this.shop = new Room();
        this.combat = new Room();
        this.loot = new Room();
        this.resource = new Room();
        this.boss = new Room();
        this.exit = new Room();
    }
}

// const addRoom = (mapData, mapData) => {
//     console.log("adding room, map data:", mapData);
// };

const DungeonGenerator = ({ floor = 0, themeName }) => {
    const mapData = {
        groundGrid: [],
        staticsGrid: [],
    };

    // Add room area to map from "spawn" room type map data
    addRoom(RoomMaps[themeName].spawn);
};

module.exports = DungeonGenerator;
