import { ComplianceIssue, ComplianceIssueActionEnum } from 'app/generated/model/compliance-issue';

/** Returns the end of the sentence containing a compliance snippet. */
export function findSentenceEnd(text: string, snippetEnd: number): number {
  if (/[.!?]["'’”\])}]*$/.test(text.slice(0, snippetEnd))) return snippetEnd;
  const match = /[.!?](?=\s|$)/.exec(text.slice(snippetEnd));
  return match ? snippetEnd + match.index + 1 : snippetEnd;
}

/** Applies an issue to stored editor HTML without switching language tabs. */
export function applyComplianceSuggestionToHtml(html: string, issue: ComplianceIssue): string | undefined {
  const target = issue.text?.trim() ?? '';
  const suggestion = issue.suggestion?.trim() ?? '';
  if (!target) return undefined;

  const container = document.createElement('div');
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  const fullText = nodes.map(node => node.data).join('');
  const start = fullText.toLowerCase().indexOf(target.toLowerCase());
  if (start === -1) return undefined;

  const locate = (offset: number, preferNextAtBoundary = false): { node: Text; offset: number } | undefined => {
    let consumed = 0;
    for (const node of nodes) {
      const nodeEnd = consumed + node.length;
      if (offset < nodeEnd || (!preferNextAtBoundary && offset === nodeEnd)) return { node, offset: offset - consumed };
      consumed += node.length;
    }
    return undefined;
  };

  const targetEnd = start + target.length;
  const end = issue.action === ComplianceIssueActionEnum.Add ? findSentenceEnd(fullText, targetEnd) : targetEnd;
  const from = locate(start, true);
  const to = locate(end);
  if (!from || !to) return undefined;

  if (issue.action === ComplianceIssueActionEnum.Add) {
    to.node.insertData(to.offset, ` ${suggestion}`);
  } else if (from.node === to.node) {
    from.node.replaceData(from.offset, to.offset - from.offset, issue.action === ComplianceIssueActionEnum.Remove ? '' : suggestion);
  } else {
    const range = document.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    range.deleteContents();
    if (issue.action !== ComplianceIssueActionEnum.Remove) {
      range.insertNode(document.createTextNode(suggestion));
    }
  }
  return container.innerHTML;
}
