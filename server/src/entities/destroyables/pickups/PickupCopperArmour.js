const Pickup = require('./Pickup');

class PickupDungiumArmour extends Pickup {}
// This entity needs to be exported before the item type that it is linked to accesses it.
module.exports = PickupDungiumArmour;

PickupDungiumArmour.prototype.registerEntityType();
PickupDungiumArmour.prototype.ItemType = require('../../../items/clothes/ItemCopperArmour');
