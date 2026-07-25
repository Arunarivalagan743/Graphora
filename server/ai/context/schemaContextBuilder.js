import { schemaCacheManager } from '../cache/schemaCache.js';

/**
 * Enterprise Schema Context Builder
 * 
 * Filters full cached graph schema to extract ONLY entity nodes, relationships,
 * and property keys relevant to a user's specific natural language question.
 */
export class SchemaContextBuilder {
  /**
   * Extracts a focused schema context for a user question.
   * 
   * @param {string} question - User's prompt text
   * @param {string} conversationHistory - Recent conversation history for follow-up resolution
   * @returns {Promise<{ relevantNodes: Array, relevantRelationships: Array, formattedContext: string }>}
   */
  async buildRelevantContext(question, conversationHistory = '') {
    const schema = await schemaCacheManager.getSchema();
    if (!schema || (!schema.nodes.length && !schema.relationships.length)) {
      return {
        relevantNodes: [],
        relevantRelationships: [],
        formattedContext: 'No graph schema entities found in database.'
      };
    }

    const combinedText = `${question} ${conversationHistory}`;
    const qLower = String(combinedText || '').toLowerCase();
    const words = qLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

    // 1. Identify matching Node Labels based on labels, properties, OR sample property values
    const matchingNodes = schema.nodes.filter(n => {
      const labelLower = n.label.toLowerCase();
      const labelMatch = words.some(w => labelLower.includes(w) || w.includes(labelLower));
      const propMatch = n.properties.some(p => words.includes(p.toLowerCase()));
      
      let sampleMatch = false;
      if (n.sampleValues) {
        Object.values(n.sampleValues).forEach(samples => {
          if (samples.some(s => words.some(w => String(s).toLowerCase().includes(w)))) {
            sampleMatch = true;
          }
        });
      }

      return labelMatch || propMatch || sampleMatch;
    });

    // Fallback: If no direct keyword match, include primary nodes (or all if small)
    const selectedNodes = matchingNodes.length > 0 ? matchingNodes : schema.nodes.slice(0, 5);
    const selectedNodeLabels = new Set(selectedNodes.map(n => n.label));

    // 2. Identify matching Relationships connecting selected nodes or mentioned in query
    const matchingRels = schema.relationships.filter(r => {
      const relTypeLower = r.type.toLowerCase().replace(/_/g, ' ');
      const isMentioned = words.some(w => relTypeLower.includes(w) || w.includes(relTypeLower));
      const connectsSelected = selectedNodeLabels.has(r.source) || selectedNodeLabels.has(r.target);
      return isMentioned || connectsSelected;
    });

    // 3. Construct clean Markdown prompt context
    let formattedContext = '### RELEVANT GRAPH SCHEMA CONTEXT FOR QUERY:\n\n';
    
    formattedContext += '#### RELEVANT NODES:\n';
    selectedNodes.forEach(n => {
      let propListStr = n.properties.map(p => {
        const samples = n.sampleValues && n.sampleValues[p];
        if (samples && samples.length > 0) {
          return `\`${p}\` [Sample Values: ${samples.map(s => `'${s}'`).join(', ')}]`;
        }
        return `\`${p}\``;
      }).join(', ');
      formattedContext += `- \`:${n.label}\` [Properties: ${propListStr}]\n`;
    });

    if (matchingRels.length > 0) {
      formattedContext += '\n#### RELEVANT RELATIONSHIPS:\n';
      matchingRels.forEach(r => {
        formattedContext += `- (\`:${r.source}\`)-[\`:${r.type}\`]->(\`:${r.target}\`)`;
        if (r.properties && r.properties.length > 0) {
          formattedContext += ` [Edge Properties: ${r.properties.map(p => `\`${p}\``).join(', ')}]`;
        }
        formattedContext += '\n';
      });
    }

    return {
      relevantNodes: selectedNodes,
      relevantRelationships: matchingRels,
      formattedContext
    };
  }
}

export const schemaContextBuilder = new SchemaContextBuilder();
