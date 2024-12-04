import payload from 'payload';
import config from '../payload.config';

async function seed() {
  await payload.init({
    config
  });

  const testImage = await payload.create({
    collection: 'media',
    data: {
      alt: 'Test Image',
    },
    filePath: 'src/assets/placeholder.jpg',
  });

  const admin = await payload.create({
    collection: 'users',
    data: {
      email: 'admin@example.com',
      password: 'development123',
      name: 'Admin User',
      role: 'admin',
    },
  });

  const category = await payload.create({
    collection: 'blog-categories',
    data: {
      name: 'Test Category',
      slug: 'test-category',
    },
  });

  await payload.create({
    collection: 'blog-posts',
    data: {
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'This is a test post',
      featuredImage: testImage.id,
      category: category.id,
      author: admin.id,
      status: 'published',
      publishedDate: new Date().toISOString(),
    },
  });

  process.exit(0);
}

seed().catch(error => {
  console.error('Seed error:', error);
  process.exit(1);
});