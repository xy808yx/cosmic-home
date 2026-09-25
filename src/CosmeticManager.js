// Pet cosmetic items (accessories + auras). Ownership and equip live
// on `progress.cosmetics`. Each item has a single slot.

import { progress } from './GameData.js';

export const PET_COSMETICS = [
  // ---- ACCESSORIES ----
  // Common
  { id: 'hat_strawberry', slot: 'accessory', name: 'Strawberry',    price: 80,  color: 0xff5b6e, rarity: 'common' },
  { id: 'hat_banana',     slot: 'accessory', name: 'Banana',        price: 80,  color: 0xffe07a, rarity: 'common' },
  { id: 'hat_avocado',    slot: 'accessory', name: 'Avocado',       price: 100, color: 0x9be8a3, rarity: 'common' },
  { id: 'acc_pineapple',  slot: 'accessory', name: 'Pineapple',     price: 100, color: 0xffd86b, rarity: 'common' },
  { id: 'acc_mango',      slot: 'accessory', name: 'Mango',         price: 100, color: 0xff8b3d, rarity: 'common' },
  { id: 'acc_watermelon', slot: 'accessory', name: 'Watermelon',    price: 100, color: 0xff5b6e, rarity: 'common' },
  { id: 'acc_coconut',    slot: 'accessory', name: 'Coconut',       price: 100, color: 0x8b6420, rarity: 'common' },
  { id: 'acc_lollipop',   slot: 'accessory', name: 'Lollipop',      price: 80,  color: 0xff5b6e, rarity: 'common' },
  { id: 'acc_chocolate',  slot: 'accessory', name: 'Chocolate Bar', price: 100, color: 0xc77a4a, rarity: 'common' },
  { id: 'acc_popsicle',   slot: 'accessory', name: 'Popsicle',      price: 100, color: 0xb6e0ff, rarity: 'common' },
  { id: 'acc_pocky',      slot: 'accessory', name: 'Pocky Stick',   price: 80,  color: 0xff9ec7, rarity: 'common' },
  { id: 'acc_cookie',     slot: 'accessory', name: 'Cookie',        price: 100, color: 0xc77a4a, rarity: 'common' },
  { id: 'acc_dango',      slot: 'accessory', name: 'Tanghulu Skewer', price: 100, color: 0xff9ec7, rarity: 'common' },
  { id: 'hat_pizza',      slot: 'accessory', name: 'Pizza Slice',   price: 100, color: 0xffae8a, rarity: 'common' },
  { id: 'hat_donut',      slot: 'accessory', name: 'Frosted Donut', price: 100, color: 0xff9ec7, rarity: 'common' },
  { id: 'acc_baseball',   slot: 'accessory', name: 'Baseball',      price: 100, color: 0xfafaf0, rarity: 'common' },

  // Rare
  { id: 'acc_shades',     slot: 'accessory', name: 'Sun Shades',    price: 250, color: 0x12122a, rarity: 'rare' },
  { id: 'acc_boba',       slot: 'accessory', name: 'Boba Tea',      price: 300, color: 0xc77eff, rarity: 'rare' },
  { id: 'acc_icecream',   slot: 'accessory', name: 'Ice Cream',     price: 300, color: 0xff9ec7, rarity: 'rare' },
  { id: 'hat_onigiri',    slot: 'accessory', name: 'Onigiri',       price: 280, color: 0xffffff, rarity: 'rare' },
  { id: 'hat_taiyaki',    slot: 'accessory', name: 'Taiyaki',       price: 300, color: 0xffd86b, rarity: 'rare' },
  { id: 'hat_sushi',      slot: 'accessory', name: 'Salmon Nigiri', price: 280, color: 0xff8b3d, rarity: 'rare' },
  { id: 'acc_basketball', slot: 'accessory', name: 'Basketball',    price: 350, color: 0xff8b3d, rarity: 'rare' },
  { id: 'acc_soccer',     slot: 'accessory', name: 'Soccer Ball',   price: 350, color: 0xffffff, rarity: 'rare' },
  { id: 'acc_tennis',     slot: 'accessory', name: 'Tennis Ball',   price: 350, color: 0xd9ed3a, rarity: 'rare' },

  // Legendary
  { id: 'acc_star_wand',  slot: 'accessory', name: 'Star Wand',     price: 1500, color: 0xffd86b, rarity: 'legendary' },
  { id: 'acc_trophy',     slot: 'accessory', name: 'Cosmic Trophy', price: 1500, color: 0xfff3b8, rarity: 'legendary' },
  { id: 'acc_cosmic_orb', slot: 'accessory', name: 'Cosmic Orb',    price: 1500, color: 0xc77eff, rarity: 'legendary' },
  { id: 'acc_dad_glasses', slot: 'accessory', name: "Dad's Glasses", price: 0, unlock_only: true, color: 0x0a0a1a, rarity: 'legendary', desc: 'Found in the workshop.' },
  { id: 'acc_dried_mango', slot: 'accessory', name: 'Dried Mango', price: 0, unlock_only: true, color: 0xf2a13a, rarity: 'legendary', desc: 'A sweet playground treat.' },
  { id: 'acc_free_cone', slot: 'accessory', name: 'Free Cone', price: 0, unlock_only: true, color: 0xfff3e0, rarity: 'legendary', desc: 'The one at the end. On the house.' },
  { id: 'acc_noodles', slot: 'accessory', name: 'Night Noodles', price: 0, unlock_only: true, color: 0xf2d98a, rarity: 'legendary', desc: 'What you eat when you are the last one in the shop.' },
  { id: 'acc_little_dome', slot: 'accessory', name: 'Little Dome', price: 0, unlock_only: true, color: 0xb3b7d0, rarity: 'legendary', desc: 'A tiny silver dome with warm gold lights.' },

  // ---- AURAS ----
  { id: 'aura_none',      slot: 'aura', name: 'None',           price: 0,    isDefault: true, color: 0x000000, rarity: 'common' },
  { id: 'aura_sparkle',   slot: 'aura', name: 'Sparkle Trail',  price: 150,  color: 0xfff3b8, rarity: 'common' },
  { id: 'aura_hearts',    slot: 'aura', name: 'Heart Bubbles',  price: 150,  color: 0xff9ec7, rarity: 'common' },
  { id: 'aura_bubbles',   slot: 'aura', name: 'Bubble Float',   price: 200,  color: 0xb6e0ff, rarity: 'common' },
  { id: 'aura_snow',      slot: 'aura', name: 'Snow Globe',     price: 200,  color: 0xffffff, rarity: 'common' },
  { id: 'aura_orbit',     slot: 'aura', name: 'Star Orbit',     price: 250,  color: 0xffe07a, rarity: 'rare' },
  { id: 'aura_petals',    slot: 'aura', name: 'Cherry Blossom', price: 280,  color: 0xff9ec7, rarity: 'rare' },
  { id: 'aura_flame',     slot: 'aura', name: 'Flame Ring',     price: 320,  color: 0xff8b3d, rarity: 'rare' },
  { id: 'aura_lightning', slot: 'aura', name: 'Storm Pulse',    price: 380,  color: 0xfff3b8, rarity: 'rare' },
  { id: 'aura_planets',   slot: 'aura', name: 'Planet Orbit',   price: 420,  color: 0x9be8a3, rarity: 'rare' },
  { id: 'aura_rainbow',   slot: 'aura', name: 'Rainbow Pulse',  price: 350,  color: 0xc77eff, rarity: 'rare' },
  { id: 'aura_embers',    slot: 'aura', name: 'Rising Embers',  price: 320,  color: 0xff8b3d, rarity: 'rare' },
  { id: 'aura_galaxy',    slot: 'aura', name: 'Mini Galaxy',    price: 1500, color: 0xc77eff, rarity: 'legendary' },
  { id: 'aura_legendary', slot: 'aura', name: 'Legendary Glow', price: 1500, color: 0xfff3b8, rarity: 'legendary' },
  { id: 'aura_constellation', slot: 'aura', name: 'Constellation', price: 1500, color: 0xb6e0ff, rarity: 'legendary' },
  // ---- Chapter 2 "Inner Space" set ----
  { id: 'aura_microbes',  slot: 'aura', name: 'Microbe Drift',  price: 350,  color: 0x9be86b, rarity: 'rare' },
  { id: 'aura_bioluminescent', slot: 'aura', name: 'Bioluminescent', price: 0, unlock_only: true, color: 0x7dffd0, rarity: 'legendary', desc: 'Glow earned in the Singularity Cell.' }
];

class CosmeticManager {
  getEquipped() {
    return { ...progress.cosmetics.pet };
  }

  ownsItem(id) {
    return progress.cosmetics.ownedIds.includes(id);
  }

  equipItem(id) {
    const item = PET_COSMETICS.find(c => c.id === id);
    if (!item || !this.ownsItem(id)) return false;
    progress.cosmetics.pet[item.slot] = id;
    progress.save();
    return true;
  }

  // Unequip a slot — for slots with a default (aura), reset to that default.
  // For nullable slots (hat, accessory), set to null.
  unequipSlot(slot) {
    const def = PET_COSMETICS.find(c => c.slot === slot && c.isDefault);
    progress.cosmetics.pet[slot] = def ? def.id : null;
    progress.save();
    return true;
  }

  // Single-save buy-and-equip.
  addAndEquip(id) {
    const item = PET_COSMETICS.find(c => c.id === id);
    if (!item) return false;
    if (!this.ownsItem(id)) progress.cosmetics.ownedIds.push(id);
    progress.cosmetics.pet[item.slot] = id;
    progress.save();
    return true;
  }

  getItemById(id) {
    return PET_COSMETICS.find(c => c.id === id) || null;
  }
}

export const cosmetics = new CosmeticManager();
