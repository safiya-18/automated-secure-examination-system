const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const connectDB = require('../config/db');
const { User } = require('../models');

async function seedAdmin() {
  console.log('🌱 Starting Super Admin account seeding process...');

  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminInitialPassword123!';

  // Connect to database
  const conn = await connectDB();
  if (!conn) {
    console.warn('⚠️  Database is offline or unreachable. Cannot seed admin at this time.');
    console.warn('   Please configure a valid MONGODB_URI in server/.env and run npm run seed:admin again.');
    process.exit(0);
  }

  try {
    // 1. Check if an admin already exists (Idempotency check)
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log(`ℹ️  Admin account already exists in database: ${existingAdmin.email}`);
      console.log('   No duplicate admin created. Seeder finished cleanly.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // 2. Check if a user with the target email exists with another role
    const emailConflict = await User.findOne({ email: adminEmail.toLowerCase() });
    if (emailConflict) {
      console.warn(`⚠️  A user with email "${adminEmail}" already exists with role "${emailConflict.role}".`);
      console.warn('   Please choose a different ADMIN_EMAIL in server/.env.');
      await mongoose.connection.close();
      process.exit(1);
    }

    // 3. Create initial Super Admin account
    const newAdmin = new User({
      name: adminName,
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword,
      role: 'admin',
      isPasswordTemporary: false, // Super admin password is intentionally configured
      accountStatus: 'active',
    });

    await newAdmin.save();

    console.log('✅ Super Admin account created successfully!');
    console.log(`   Name: ${newAdmin.name}`);
    console.log(`   Email: ${newAdmin.email}`);
    console.log(`   Role: ${newAdmin.role}`);
    console.log('   (Password hashed securely with bcrypt)');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during Admin seeding:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

seedAdmin();

