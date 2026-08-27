import { ComplianceIssue, ComplianceIssueActionEnum } from 'app/generated/model/compliance-issue';

/** Returns the end of the sentence containing a compliance snippet. */
export function findSentenceEnd(text: string, snippetEnd: number): number {
  if (/[.!?]["'’”\])}]*$/.test(text.slice(0, snippetEnd))) return snippetEnd;
  const match = /[.!?](?=\s|$)/.exec(text.slice(snippetEnd));
  return match ? snippetEnd + match.index + 1 : snippetEnd;
}

/** Converts a compliance suggestion into a text edit. */
export function getComplianceSuggestionTextEdit(
  text: string,
  issue: ComplianceIssue,
): { index: number; deleteLength: number; insert: string } | undefined {
  const target = issue.text?.trim() ?? '';
  const suggestion = issue.suggestion?.trim() ?? '';
  if (!target) return undefined;

  const index = text.toLowerCase().indexOf(target.toLowerCase());
  if (index === -1) return undefined;

  switch (issue.action) {
    case ComplianceIssueActionEnum.Replace:
      return { index, deleteLength: target.length, insert: suggestion };
    case ComplianceIssueActionEnum.Remove:
      return { index, deleteLength: target.length, insert: '' };
    case ComplianceIssueActionEnum.Add:
      return { index: findSentenceEnd(text, index + target.length), deleteLength: 0, insert: ` ${suggestion}` };
    default:
      return undefined;
  }
}

/** Applies an issue to stored editor HTML without switching language tabs. */
export function applyComplianceSuggestionToHtml(html: string, issue: ComplianceIssue): string | undefined {
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
  const edit = getComplianceSuggestionTextEdit(fullText, issue);
  if (!edit) return undefined;

  const locate = (offset: number, preferNextAtBoundary = false): { node: Text; offset: number } | undefined => {
    let consumed = 0;
    for (const node of nodes) {
      const nodeEnd = consumed + node.length;
      if (offset < nodeEnd || (!preferNextAtBoundary && offset === nodeEnd)) return { node, offset: offset - consumed };
      consumed += node.length;
    }
    return undefined;
  };

  const to = locate(edit.index + edit.deleteLength);
  if (!to) return undefined;

  if (edit.deleteLength === 0) {
    to.node.insertData(to.offset, edit.insert);
  } else {
    const from = locate(edit.index, true);
    if (!from) return undefined;
    if (from.node === to.node) {
      from.node.replaceData(from.offset, to.offset - from.offset, edit.insert);
    } else {
      const range = document.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      range.deleteContents();
      if (edit.insert) {
        range.insertNode(document.createTextNode(edit.insert));
      }
    }
  }
  return container.innerHTML;
}
