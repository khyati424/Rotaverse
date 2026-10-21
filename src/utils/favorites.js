const Favorite = require('../models/Favorite');
const Business = require('../models/Business');
const User = require('../models/User');
const { normalizeEmail } = require('./ownership');

/**
 * Favorites are people: a user saves another user (Favorite.personId = that user's id).
 * A business shows isFavorite when its owner is one of the saved people.
 */

/** Ids of the people the user saved. Empty for guests. */
const favoritePeopleOf = async (user) => {
  if (!user) return new Set();
  const favs = await Favorite.find({ userId: user.id }).select('personId');
  return new Set(favs.map((f) => f.personId));
};

/** Emails of the people the user saved, for marking their businesses (Business.ownerEmail). */
const favoriteOwnerEmailsOf = async (user) => {
  const ids = await favoritePeopleOf(user);
  if (!ids.size) return new Set();
  const people = await User.find({ id: { $in: [...ids] } }).select('email');
  return new Set(people.map((p) => normalizeEmail(p.email)));
};

/**
 * One-time migration: favorites used to be businesses (businessId). Turn each into a favorite of the
 * business's owner, drop the ones without an owner or that repeat, and replace the old indexes.
 * Safe to run on every start.
 */
const migrateFavoritesToPeople = async () => {
  const collection = Favorite.collection;
  const old = await collection.find({ businessId: { $exists: true } }).toArray();
  if (old.length) {
    const businesses = await Business.find({ id: { $in: old.map((f) => f.businessId) } }).select('id ownerEmail');
    const ownerEmailOf = new Map(businesses.map((b) => [b.id, b.ownerEmail]));
    const owners = await User.find({ email: { $in: [...new Set(ownerEmailOf.values())].filter(Boolean) } }).select('id email');
    const personIdOf = new Map(owners.map((u) => [normalizeEmail(u.email), u.id]));

    const seen = new Set(
      (await collection.find({ personId: { $exists: true } }).toArray()).map((f) => `${f.userId}:${f.personId}`)
    );
    let converted = 0;
    for (const fav of old) {
      const personId = personIdOf.get(ownerEmailOf.get(fav.businessId));
      const key = `${fav.userId}:${personId}`;
      if (!personId || seen.has(key)) {
        await collection.deleteOne({ _id: fav._id });
        continue;
      }
      seen.add(key);
      await collection.updateOne({ _id: fav._id }, { $set: { personId }, $unset: { businessId: '' } });
      converted += 1;
    }
    console.log(`[MIGRATION] Favorites: ${converted} turned into saved people, ${old.length - converted} removed`);
  }
  // Drops the old businessId indexes (their unique index would block saving more than one person).
  await Favorite.syncIndexes();
};

module.exports = { favoritePeopleOf, favoriteOwnerEmailsOf, migrateFavoritesToPeople };
