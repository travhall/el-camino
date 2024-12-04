import { test, expect, describe } from 'vitest';
import payload from 'payload';
import { Post, Category } from '../payload-types';

// Test data
const testPost = {
  title: 'Test Blog Post',
  content: [{ type: 'paragraph', children: [{ text: 'Test content' }] }],
  status: 'draft',
  categories: [],
  slug: 'test-blog-post'
};

const testCategory = {
  name: 'Test Category',
  slug: 'test-category'
};

describe('Blog Collection Integration', () => {
  // Setup
  beforeAll(async () => {
    await payload.init({
      secret: 'test',
      local: true,
      onInit: async () => {
        // Clear test data
        await payload.delete({
          collection: 'posts',
          where: { slug: { equals: testPost.slug } }
        });
        await payload.delete({
          collection: 'categories',
          where: { slug: { equals: testCategory.slug } }
        });
      }
    });
  });

  // Category Tests
  describe('Category Management', () => {
    let createdCategory: Category;

    test('creates category', async () => {
      createdCategory = await payload.create({
        collection: 'categories',
        data: testCategory
      });
      
      expect(createdCategory.name).toBe(testCategory.name);
      expect(createdCategory.slug).toBe(testCategory.slug);
    });

    test('retrieves category', async () => {
      const retrieved = await payload.find({
        collection: 'categories',
        where: { slug: { equals: testCategory.slug } }
      });

      expect(retrieved.docs[0].name).toBe(testCategory.name);
    });
  });

  // Post Tests
  describe('Post Management', () => {
    let createdPost: Post;

    test('creates post with relationships', async () => {
      const category = await payload.create({
        collection: 'categories',
        data: testCategory
      });

      createdPost = await payload.create({
        collection: 'posts',
        data: {
          ...testPost,
          categories: [category.id]
        }
      });

      expect(createdPost.title).toBe(testPost.title);
      expect(createdPost.categories).toHaveLength(1);
    });

    test('updates post status', async () => {
      const updated = await payload.update({
        collection: 'posts',
        id: createdPost.id,
        data: {
          status: 'published'
        }
      });

      expect(updated.status).toBe('published');
    });

    test('retrieves post with populated relationships', async () => {
      const retrieved = await payload.find({
        collection: 'posts',
        where: { slug: { equals: testPost.slug } },
        depth: 2
      });

      const post = retrieved.docs[0];
      expect(post.categories[0].name).toBe(testCategory.name);
    });
  });

  // Frontend Integration Tests
  describe('Frontend Integration', () => {
    test('formats post data for frontend', async () => {
      const post = await payload.find({
        collection: 'posts',
        where: { slug: { equals: testPost.slug } }
      });

      const formatted = {
        title: post.docs[0].title,
        content: post.docs[0].content,
        slug: post.docs[0].slug,
        categories: post.docs[0].categories.map(cat => ({
          name: cat.name,
          slug: cat.slug
        }))
      };

      expect(formatted.title).toBe(testPost.title);
      expect(formatted.slug).toBe(testPost.slug);
    });
  });

  // Cleanup
  afterAll(async () => {
    await payload.delete({
      collection: 'posts',
      where: { slug: { equals: testPost.slug } }
    });
    await payload.delete({
      collection: 'categories',
      where: { slug: { equals: testCategory.slug } }
    });
  });
});