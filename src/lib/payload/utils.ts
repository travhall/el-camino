import type { Block, ContentBlock, ImageGalleryBlock, VideoBlock } from './types';

export function getMediaUrl(url: string): string {
  const PAYLOAD_URL = import.meta.env.PUBLIC_PAYLOAD_URL || "http://localhost:3000";
  if (!url) return "";
  return url.startsWith("http") ? url : `${PAYLOAD_URL}${url}`;
}

interface LexicalNode {
  type: string;
  tag?: string;
  listType?: 'number' | 'bullet';
  url?: string;
  newTab?: boolean;
  src?: string;
  altText?: string;
  width?: number;
  height?: number;
  language?: string;
  code?: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  children?: LexicalNode[];
}

export async function lexicalToHtml(content: { root: { children: LexicalNode[] } } | null): Promise<string> {
  if (!content?.root?.children) return "";

  function processNode(node: LexicalNode): string {
    switch (node.type) {
      case "paragraph":
        return `<p>${processChildren(node.children)}</p>`;
      case "heading":
        return `<h${node.tag}>${processChildren(node.children)}</h${node.tag}>`;
      case "list":
        const listTag = node.listType === "number" ? "ol" : "ul";
        return `<${listTag}>${processChildren(node.children)}</${listTag}>`;
      case "listitem":
        return `<li>${processChildren(node.children)}</li>`;
      case "link":
        return `<a href="${node.url}" ${node.newTab ? 'target="_blank" rel="noopener noreferrer"' : ''}>${processChildren(node.children)}</a>`;
      case "image":
        return `<img src="${getMediaUrl(node.src || '')}" alt="${node.altText || ''}" ${node.width ? `width="${node.width}"` : ''} ${node.height ? `height="${node.height}"` : ''} loading="lazy" />`;
      case "quote":
        return `<blockquote>${processChildren(node.children)}</blockquote>`;
      case "code":
        return `<pre><code class="language-${node.language || 'plain'}">${node.code}</code></pre>`;
      default:
        if (node.text) {
          let text = node.text;
          if (node.bold) text = `<strong>${text}</strong>`;
          if (node.italic) text = `<em>${text}</em>`;
          if (node.underline) text = `<u>${text}</u>`;
          if (node.code) text = `<code>${text}</code>`;
          return text;
        }
        return "";
    }
  }

  function processChildren(children: LexicalNode[] | undefined): string {
    if (!Array.isArray(children)) return "";
    return children.map(child => processNode(child)).join("");
  }

  try {
    return content.root.children.map(node => processNode(node)).join("\n");
  } catch (error) {
    console.error("Error processing Lexical content:", error);
    return "";
  }
}

export async function renderBlock(block: Block): Promise<string> {
  switch (block.blockType) {
    case 'content': {
      const contentBlock = block as ContentBlock;
      const html = await lexicalToHtml(contentBlock.content);
      return `<div class="content-block ${contentBlock.appearance}">${html}</div>`;
    }
    
    case 'imageGallery': {
      const galleryBlock = block as ImageGalleryBlock;
      const images = galleryBlock.images.map(item => `
        <div class="gallery-item">
          <img 
            src="${getMediaUrl(item.image.url)}" 
            alt="${item.image.alt || ''}"
            loading="lazy"
            class="w-full h-full object-cover rounded-lg"
          />
          ${item.caption ? `<p class="text-content-caption mt-2">${item.caption}</p>` : ''}
        </div>
      `).join('');
      
      return `
        <div class="image-gallery grid gap-4 mb-8" style="grid-template-columns: repeat(${galleryBlock.columns}, 1fr);">
          ${images}
        </div>
      `;
    }
    
    case 'video': {
      const videoBlock = block as VideoBlock;
      return `
        <div class="video-block mb-8">
          <div class="aspect-video rounded-lg overflow-hidden">
            <iframe
              src="${videoBlock.url}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              class="w-full h-full"
            ></iframe>
          </div>
          ${videoBlock.caption ? `<p class="text-content-caption mt-2">${videoBlock.caption}</p>` : ''}
          ${videoBlock.transcript ? `
            <details class="mt-4">
              <summary class="text-content-meta cursor-pointer">View Transcript</summary>
              <div class="mt-2 text-content-body">${videoBlock.transcript}</div>
            </details>
          ` : ''}
        </div>
      `;
    }
    
    default:
      console.warn(`Unknown block type: ${(block as Block).blockType}`);
      return '';
  }
}

export async function renderBlocks(blocks: Block[]): Promise<string> {
  const renderedBlocks = await Promise.all(blocks.map(block => renderBlock(block)));
  return renderedBlocks.join('\n');
}