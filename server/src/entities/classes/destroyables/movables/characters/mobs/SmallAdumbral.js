const Mob = require("./Mob");
const DayPhases = require("../../../../../../DayPhases");
const Damage = require("../../../../../../gameplay/Damage");
const Heal = require("../../../../../../gameplay/Heal");

class SmallAdumbral extends Mob {
    constructor(config) {
        super(config);

        this.timeCheckTimeout = setInterval(this.checkTime.bind(this), 5000);
    }

    onDestroy() {
        clearTimeout(this.timeCheckTimeout);

        super.onDestroy();
    }

    checkTime() {
        if (this.board.dayPhase === DayPhases.Night) {
            this.heal(new Heal(5));
        }
        else if (this.board.dayPhase === DayPhases.Day) {
            this.damage(new Damage({ amount: 20, armourPiercing: 1 }));
        }
        else {
            // Must be dawn/dusk.
            this.damage(new Damage({ amount: 10, armourPiercing: 1 }));
        }
    }
}
module.exports = SmallAdumbral;

SmallAdumbral.prototype.taskIdKilled = require("../../../../../../tasks/TaskTypes").KillAdumbrals.taskId;

SmallAdumbral.prototype.spawnableDayPhases = {
    [DayPhases.Night]: true,
};
