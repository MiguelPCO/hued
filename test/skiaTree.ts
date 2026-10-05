// Utilidades sobre `render(...).toJSON()` de RNTL. Evitan depender de tipos de
// react-test-renderer y permiten buscar elementos host por nombre.
export interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: (HostNode | string)[] | null;
}

function asNodes(json: unknown): HostNode[] {
  if (!json) return [];
  return Array.isArray(json) ? (json as HostNode[]) : [json as HostNode];
}

export function findAll(json: unknown, type: string): HostNode[] {
  const found: HostNode[] = [];
  const walk = (node: HostNode | string) => {
    if (typeof node === 'string') return;
    if (node.type === type) found.push(node);
    node.children?.forEach(walk);
  };
  asNodes(json).forEach(walk);
  return found;
}

export function findTexts(json: unknown): string[] {
  return findAll(json, 'SkText').map((node) => String(node.props.text));
}

/** Serialización estable del árbol, sin la escala (`transform`) que difiere entre preview y export. */
export function treeSignature(json: unknown): string {
  return JSON.stringify(json, (key, value) => (key === 'transform' ? undefined : value));
}
