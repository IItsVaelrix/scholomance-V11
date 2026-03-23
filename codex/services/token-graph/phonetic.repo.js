import { createGraphEdge, createGraphNode } from '../../core/token-graph/build.js';
import { clamp01, mergeUniqueStrings, normalizeGraphToken } from '../../core/token-graph/types.js';

const DEFAULT_EDGE_LIMIT = 24;
const DEFAULT_BUCKET_LIMIT = 48;

function scoreBucketSimilarity(anchorNode, candidateNode) {
  if (!anchorNode || !candidateNode) return 0;

  let score = 0.36;
  if (anchorNode.endingSignature && anchorNode.endingSignature === candidateNode.endingSignature) {
    score += 0.28;
  }
  if (anchorNode.stressPattern && anchorNode.stressPattern === candidateNode.stressPattern) {
    score += 0.16;
  }
  if (anchorNode.syllableCount && anchorNode.syllableCount === candidateNode.syllableCount) {
    score += 0.12;
  }
  if (anchorNode.onsetSignature && anchorNode.onsetSignature === candidateNode.onsetSignature) {
    score += 0.08;
  }

  return clamp01(score);
}

function toGraphNode(lexiconNode) {
  if (!lexiconNode || typeof lexiconNode !== 'object') return null;
  return createGraphNode({
    id: String(lexiconNode.id || ''),
    token: lexiconNode.token,
    normalized: lexiconNode.normalized,
    nodeType: 'LEXEME',
    frequencyScore: lexiconNode.frequencyScore,
    phoneticSignature: lexiconNode.signature || undefined,
  });
}

export function createTokenGraphPhoneticRepo(options = {}) {
  const lexiconRepo = options.lexiconRepo ?? null;
  const indexRepo = options.indexRepo ?? null;

  function lookupNode(token) {
    if (!lexiconRepo || typeof lexiconRepo.lookupNodeByNormalized !== 'function') return null;
    return toGraphNode(lexiconRepo.lookupNodeByNormalized(token));
  }

  function buildNeighborhood(anchorTokens = [], neighborhoodOptions = {}) {
    const nodes = [];
    const edges = [];
    const clusters = [];
    const nodeLookup = new Map();
    const edgeLimit = Number.isInteger(Number(neighborhoodOptions.edgeLimit))
      ? Number(neighborhoodOptions.edgeLimit)
      : DEFAULT_EDGE_LIMIT;
    const bucketLimit = Number.isInteger(Number(neighborhoodOptions.bucketLimit))
      ? Number(neighborhoodOptions.bucketLimit)
      : DEFAULT_BUCKET_LIMIT;

    const normalizedAnchors = [...new Set((Array.isArray(anchorTokens) ? anchorTokens : [])
      .map(normalizeGraphToken)
      .filter(Boolean))];

    normalizedAnchors.forEach((token) => {
      const anchorNode = lookupNode(token);
      if (!anchorNode) return;
      nodes.push(anchorNode);
      nodeLookup.set(anchorNode.id, anchorNode);

      if (typeof indexRepo?.lookupHotEdges === 'function') {
        const hotEdges = indexRepo.lookupHotEdges(anchorNode.id, edgeLimit);
        hotEdges.forEach((hotEdge) => {
          const destinationNode = typeof lexiconRepo?.lookupNodeById === 'function'
            ? toGraphNode(lexiconRepo.lookupNodeById(hotEdge.toId))
            : null;
          if (!destinationNode) return;

          nodes.push(destinationNode);
          nodeLookup.set(destinationNode.id, destinationNode);

          edges.push({
            id: `${anchorNode.id}::${destinationNode.id}::PHONETIC_SIMILARITY`,
            fromId: anchorNode.id,
            toId: destinationNode.id,
            relation: 'PHONETIC_SIMILARITY',
            weight: clamp01(hotEdge.overallScore),
            evidence: mergeUniqueStrings(hotEdge.reasons, [
              `exact=${Number(hotEdge.exactRhymeScore || 0).toFixed(3)}`,
              `slant=${Number(hotEdge.slantRhymeScore || 0).toFixed(3)}`,
            ]),
            dimensions: {
              exactRhymeScore: Number(hotEdge.exactRhymeScore) || 0,
              slantRhymeScore: Number(hotEdge.slantRhymeScore) || 0,
              vowelMatchScore: Number(hotEdge.vowelMatchScore) || 0,
              consonantMatchScore: Number(hotEdge.consonantMatchScore) || 0,
              stressAlignmentScore: Number(hotEdge.stressAlignmentScore) || 0,
            },
          });
        });
      }

      if (typeof indexRepo?.lookupBucketMembers === 'function' && anchorNode.phoneticSignature?.endingSignature) {
        const bucketMembers = indexRepo.lookupBucketMembers(anchorNode.phoneticSignature.endingSignature, bucketLimit);
        bucketMembers.forEach((bucketNode) => {
          const destinationNode = toGraphNode(bucketNode);
          if (!destinationNode || destinationNode.id === anchorNode.id || nodeLookup.has(destinationNode.id)) {
            return;
          }
          const weight = scoreBucketSimilarity(anchorNode.phoneticSignature || anchorNode, bucketNode);
          nodes.push(destinationNode);
          nodeLookup.set(destinationNode.id, destinationNode);
          edges.push({
            id: `${anchorNode.id}::${destinationNode.id}::PHONETIC_SIMILARITY::bucket`,
            fromId: anchorNode.id,
            toId: destinationNode.id,
            relation: 'PHONETIC_SIMILARITY',
            weight,
            evidence: ['bucket_fallback'],
            dimensions: {
              bucketSimilarity: weight,
            },
          });
        });
      }

      if (typeof indexRepo?.lookupClustersByEndingSignature === 'function' && anchorNode.phoneticSignature?.endingSignature) {
        clusters.push(...indexRepo.lookupClustersByEndingSignature(anchorNode.phoneticSignature.endingSignature, 6));
      }
    });

    const materializedNodes = [...new Map(nodes.map((node) => [node.id, node])).values()];
    const graphNodeLookup = new Map(materializedNodes.map((node) => [node.id, node]));
    const materializedEdges = edges
      .map((edge) => createGraphEdge(edge, graphNodeLookup))
      .filter(Boolean);

    return {
      nodes: materializedNodes,
      edges: materializedEdges,
      clusters,
    };
  }

  return {
    lookupNode,
    buildNeighborhood,
  };
}
