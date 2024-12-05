import { getBlogPost } from '../blog'

describe('Blog functionality', () => {
  it('should fetch blog post by slug', async () => {
    const post = await getBlogPost('test-post')
    expect(post).toBeDefined()
  })
})