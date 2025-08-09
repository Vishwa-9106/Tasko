const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function dropGeospatialIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get the users collection
    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // List all indexes to see what exists
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key));
    });

    // Try to drop any geospatial indexes on location field
    try {
      await collection.dropIndex({ location: '2dsphere' });
      console.log('✅ Dropped location 2dsphere index');
    } catch (error) {
      console.log('ℹ️  Location 2dsphere index not found or already dropped');
    }

    // Try to drop the compound index that includes location
    try {
      await collection.dropIndex({ email: 1, userType: 1, location: '2dsphere', services: 1, isActive: 1 });
      console.log('✅ Dropped compound index with location 2dsphere');
    } catch (error) {
      console.log('ℹ️  Compound index with location 2dsphere not found or already dropped');
    }

    // List indexes after cleanup
    const indexesAfter = await collection.indexes();
    console.log('📋 Indexes after cleanup:');
    indexesAfter.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('🎉 Index cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during index cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

dropGeospatialIndex();
