// Migration script to update all existing learning profiles
// Run this script to add the new study preference and learning style fields to existing profiles

const migrateLearningProfiles = async () => {
  try {
    console.log('Starting learning profiles migration...');
    
    const response = await fetch('/api/learning-profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'migrateAllProfiles'
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(result.message);
      console.log('Migration results:', result.results);
    } else {
      console.error('❌ Migration failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
};

// Export for use in other scripts
export default migrateLearningProfiles;

// If running directly, execute the migration
if (typeof window !== 'undefined') {
  // Browser environment
  window.migrateLearningProfiles = migrateLearningProfiles;
} else {
  // Node.js environment
  console.log('Migration script loaded. Call migrateLearningProfiles() to run the migration.');
} 