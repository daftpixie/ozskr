/**
 * Markdown Renderer
 * Simple markdown-to-HTML renderer for legal documents
 * Handles: headings, paragraphs, bold, italic, lists, tables, links, horizontal rules
 */

import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.JSX.Element[] = [];
  let lineIndex = 0;

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // Parse links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-solana-purple hover:text-solana-green underline transition-colors">$1</a>');
    // Parse bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
    // Parse italic: *text*
    text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    // Parse inline code: `text`
    text = text.replace(/`([^`]+)`/g, '<code class="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-solana-green">$1</code>');

    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    // Heading 1: # Text
    if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('## ')) {
      elements.push(
        <h1 key={lineIndex} className="font-display mb-6 mt-8 text-4xl font-bold text-white">
          {parseInlineMarkdown(trimmedLine.slice(2))}
        </h1>
      );
      lineIndex++;
      continue;
    }

    // Heading 2: ## Text
    if (trimmedLine.startsWith('## ') && !trimmedLine.startsWith('### ')) {
      elements.push(
        <h2 key={lineIndex} className="font-display mb-4 mt-8 text-3xl font-bold text-white">
          {parseInlineMarkdown(trimmedLine.slice(3))}
        </h2>
      );
      lineIndex++;
      continue;
    }

    // Heading 3: ### Text
    if (trimmedLine.startsWith('### ') && !trimmedLine.startsWith('#### ')) {
      elements.push(
        <h3 key={lineIndex} className="font-display mb-3 mt-6 text-2xl font-semibold text-white">
          {parseInlineMarkdown(trimmedLine.slice(4))}
        </h3>
      );
      lineIndex++;
      continue;
    }

    // Heading 4: #### Text
    if (trimmedLine.startsWith('#### ')) {
      elements.push(
        <h4 key={lineIndex} className="font-display mb-2 mt-4 text-xl font-semibold text-white">
          {parseInlineMarkdown(trimmedLine.slice(5))}
        </h4>
      );
      lineIndex++;
      continue;
    }

    // Horizontal rule: ---
    if (trimmedLine === '---') {
      elements.push(<hr key={lineIndex} className="my-8 border-white/10" />);
      lineIndex++;
      continue;
    }

    // Unordered list: - item
    if (trimmedLine.startsWith('- ')) {
      const listItems: React.JSX.Element[] = [];
      while (lineIndex < lines.length && lines[lineIndex].trim().startsWith('- ')) {
        const itemText = lines[lineIndex].trim().slice(2);
        listItems.push(
          <li key={lineIndex} className="mb-2">
            {parseInlineMarkdown(itemText)}
          </li>
        );
        lineIndex++;
      }
      elements.push(
        <ul key={`ul-${lineIndex}`} className="mb-6 ml-6 list-disc space-y-2 text-muted-foreground">
          {listItems}
        </ul>
      );
      continue;
    }

    // Ordered list: 1. item (or 2., 3., etc.)
    if (/^\d+\.\s/.test(trimmedLine)) {
      const listItems: React.JSX.Element[] = [];
      while (lineIndex < lines.length && /^\d+\.\s/.test(lines[lineIndex].trim())) {
        const itemText = lines[lineIndex].trim().replace(/^\d+\.\s/, '');
        listItems.push(
          <li key={lineIndex} className="mb-2">
            {parseInlineMarkdown(itemText)}
          </li>
        );
        lineIndex++;
      }
      elements.push(
        <ol key={`ol-${lineIndex}`} className="mb-6 ml-6 list-decimal space-y-2 text-muted-foreground">
          {listItems}
        </ol>
      );
      continue;
    }

    // Table: starts with | and contains |
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const tableRows: string[][] = [];
      const startIndex = lineIndex;

      while (lineIndex < lines.length && lines[lineIndex].trim().startsWith('|')) {
        const rowData = lines[lineIndex]
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0);

        // Skip separator rows (|---|---|)
        if (!rowData.every(cell => /^-+$/.test(cell))) {
          tableRows.push(rowData);
        }
        lineIndex++;
      }

      if (tableRows.length > 0) {
        const [headerRow, ...bodyRows] = tableRows;
        elements.push(
          <div key={`table-${startIndex}`} className="mb-6 overflow-x-auto">
            <table className="min-w-full border-collapse border border-white/10">
              <thead>
                <tr className="bg-white/5">
                  {headerRow.map((cell, i) => (
                    <th key={i} className="border border-white/10 px-4 py-2 text-left font-semibold text-white">
                      {parseInlineMarkdown(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="even:bg-white/[0.02]">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border border-white/10 px-4 py-2 text-muted-foreground">
                        {parseInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Empty line
    if (trimmedLine === '') {
      lineIndex++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={lineIndex} className="mb-4 leading-7 text-muted-foreground">
        {parseInlineMarkdown(trimmedLine)}
      </p>
    );
    lineIndex++;
  }

  return <div className="prose-legal">{elements}</div>;
}
