import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, XCircle, X, Layers, Cpu, Loader2, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import type { DetailedClusterCapacity, AutoscalerDetectionResult, DeploymentMode, OptimusRecommendation, OptimusRankedOption } from '@/lib/api';
import { optimusApi } from '@/lib/api';
import type { MultiNodeRecommendation } from '@/lib/gpu-recommendations';

interface CapacityWarningProps {
  selectedGpus: number;
  capacity: DetailedClusterCapacity;
  autoscaler?: AutoscalerDetectionResult;
  /** Maximum GPUs needed by a single pod (for node placement) */
  maxGpusPerPod?: number;
  /** Deployment mode for better messaging */
  deploymentMode?: DeploymentMode;
  /** Number of replicas (for aggregated mode) */
  replicas?: number;
  /** GPUs per replica (for aggregated mode) */
  gpusPerReplica?: number;
  /** Multi-node deployment info */
  multiNode?: MultiNodeRecommendation | null;
  /** Model ID for Optimus SKU recommendation */
  modelId?: string;
  /** Parameter count for Optimus SKU recommendation */
  parameterCount?: number | null;
}

function fmt(v: number | null | undefined): string {
  return v != null ? `$${v.toFixed(2)}` : 'N/A';
}

function SkuOptionDetail({ opt }: { opt: OptimusRankedOption }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-gray-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-gray-100">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{opt.vmSize}</span>
        <span className="text-green-700 dark:text-green-400">
          {opt.onDemandPerHour != null
            ? `$${opt.onDemandPerHour.toFixed(2)}/hr`
            : 'Price N/A'}
        </span>
      </div>
      <div className="mt-1 text-gray-600 dark:text-gray-400">
        {opt.gpuCount}× {opt.gpuModel} · {opt.totalVramGb} GB VRAM
        {opt.nodesRequired > 1 && ` · ${opt.nodesRequired} nodes`}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-1.5 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronRight className="h-3 w-3" />}
        {expanded ? 'Hide details' : 'Show details'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 border-t border-blue-200 pt-2 text-gray-700 dark:border-blue-700 dark:text-gray-300">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>VRAM per GPU</span>
            <span className="font-medium">{opt.vramPerGpuGb} GB</span>
            <span>On-demand</span>
            <span className="font-medium">{fmt(opt.onDemandPerHour)}/hr</span>
            <span>Spot</span>
            <span className="font-medium">{fmt(opt.spotPerHour)}/hr</span>
            <span>Total cost</span>
            <span className="font-medium">{fmt(opt.totalCostPerHour)}/hr</span>
            <span>Monthly estimate</span>
            <span className="font-medium">
              {opt.monthlyCostEstimate != null
                ? `$${opt.monthlyCostEstimate.toFixed(0)}`
                : 'N/A'}
            </span>
            <span>Score</span>
            <span className="font-medium">{opt.score?.toFixed(2) ?? 'N/A'}</span>
            <span>Nodes required</span>
            <span className="font-medium">{opt.nodesRequired}</span>
          </div>
          {opt.docsUrl && (
            <a
              href={opt.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-blue-600 underline hover:no-underline dark:text-blue-400"
            >
              VM documentation <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function gpuBadgeColor(gpu: string): string {
  const g = gpu.replace(/\s/g, '');
  if (g.includes('H100')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  if (g.includes('H200')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  if (g.includes('A100')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (g.includes('GB200') || g.includes('GB300')) return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
  if (g.includes('MI300')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function SkuRecommendations({ recommendation }: { recommendation: OptimusRecommendation }) {
  const [showFull, setShowFull] = useState(false);
  const topOptions = recommendation.rankedOptions.slice(0, 1);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
        Recommended GPU SKU(s):
      </p>
      {topOptions.map((opt) => (
        <SkuOptionDetail key={opt.vmSize} opt={opt} />
      ))}
      {recommendation.vramAnalysis && recommendation.vramAnalysis.totalGb > 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          VRAM analysis: {recommendation.vramAnalysis.weightsGb.toFixed(1)} GB weights
          + {recommendation.vramAnalysis.kvCacheTotalGb.toFixed(1)} GB KV cache
          + {recommendation.vramAnalysis.overheadGb.toFixed(1)} GB overhead
          = {recommendation.vramAnalysis.totalGb.toFixed(1)} GB total
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowFull(!showFull)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {showFull
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronRight className="h-3 w-3" />}
        {showFull ? 'Hide all recommendations' : `Show all recommendations (${recommendation.rankedOptions.length} SKUs)`}
      </button>
      {showFull && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60">
          {/* VRAM Analysis Cards */}
          {recommendation.vramAnalysis && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-teal-700 dark:text-teal-400">
                VRAM Analysis
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center dark:border-gray-700 dark:bg-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Weights</div>
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {recommendation.vramAnalysis.weightsGb.toFixed(1)} GB
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center dark:border-gray-700 dark:bg-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">KV Cache</div>
                  <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                    {recommendation.vramAnalysis.kvCacheTotalGb.toFixed(1)} GB
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center dark:border-gray-700 dark:bg-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Required</div>
                  <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {recommendation.vramAnalysis.totalGb.toFixed(1)} GB
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ranked VM Options Table */}
          {recommendation.rankedOptions.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Ranked VM Options
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="pb-1.5 pr-2">#</th>
                      <th className="pb-1.5 pr-2">VM SKU</th>
                      <th className="pb-1.5 pr-2">GPU</th>
                      <th className="pb-1.5 pr-2">Count</th>
                      <th className="pb-1.5 pr-2">Total VRAM</th>
                      <th className="pb-1.5 pr-2">Nodes</th>
                      <th className="pb-1.5 pr-2">Score</th>
                      <th className="pb-1.5 pr-2">On-Demand</th>
                      <th className="pb-1.5 pr-2">Spot</th>
                      <th className="pb-1.5">Monthly Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendation.rankedOptions.map((opt, i) => (
                      <tr
                        key={opt.vmSize}
                        className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-1.5 pr-2 text-gray-400">{i + 1}</td>
                        <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-gray-100">
                          {opt.vmSize}
                          {opt.docsUrl && (
                            <a href={opt.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-gray-400 hover:text-blue-500">
                              <ExternalLink className="inline h-2.5 w-2.5" />
                            </a>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`inline-block rounded-full px-1.5 py-0.5 text-xs font-medium ${gpuBadgeColor(opt.gpuModel)}`}>
                            {opt.gpuModel}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">{opt.gpuCount}×</td>
                        <td className="py-1.5 pr-2">{opt.totalVramGb} GB</td>
                        <td className="py-1.5 pr-2">{opt.nodesRequired}</td>
                        <td className="py-1.5 pr-2 font-semibold text-teal-600 dark:text-teal-400">
                          {opt.score?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-1.5 pr-2">{opt.onDemandPerHour != null ? `$${opt.onDemandPerHour.toFixed(2)}/hr` : '—'}</td>
                        <td className="py-1.5 pr-2">{opt.spotPerHour != null ? `$${opt.spotPerHour.toFixed(2)}/hr` : '—'}</td>
                        <td className="py-1.5">{opt.monthlyCostEstimate != null ? `$${opt.monthlyCostEstimate.toFixed(0)}/mo` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Explanation Trace Table */}
          {recommendation.trace?.entries && recommendation.trace.entries.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Explanation Trace
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="pb-1.5 pr-3">Stage</th>
                      <th className="pb-1.5 pr-3">Decision</th>
                      <th className="pb-1.5">Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendation.trace.entries.map((entry, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="whitespace-nowrap py-1.5 pr-3 font-medium text-teal-600 dark:text-teal-400">
                          {entry.stage}
                        </td>
                        <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-100">
                          {entry.decision}
                        </td>
                        <td className="py-1.5 text-gray-900 dark:text-gray-100">
                          {entry.reasoning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendSkuButton({
  modelId,
  parameterCount,
}: {
  modelId?: string;
  parameterCount?: number | null;
}) {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<OptimusRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!modelId) return null;

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await optimusApi.recommendSku({
        modelId,
        parameterCount: parameterCount ?? undefined,
        strategy: 'deterministic',
      });
      setRecommendation(result);
      if (!result.rankedOptions?.length) {
        setError('No matching SKUs found.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = loading
    ? 'Getting recommendations…'
    : recommendation
      ? 'Refresh'
      : 'Recommend GPU SKU';

  return (
    <div className="mt-3 text-gray-900 dark:text-gray-100">
      {recommendation && recommendation.rankedOptions.length > 0 && (
        <SkuRecommendations recommendation={recommendation} />
      )}
      {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : recommendation ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <Cpu className="h-3 w-3" />
          )}
          {buttonLabel}
        </button>
        {recommendation && !loading && (
          <button
            type="button"
            onClick={() => { setRecommendation(null); setError(null); }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-3 w-3" />
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function CapacityWarning({
  selectedGpus,
  capacity,
  autoscaler,
  maxGpusPerPod,
  deploymentMode,
  replicas,
  gpusPerReplica,
  multiNode,
  modelId,
  parameterCount,
}: CapacityWarningProps) {
  // Use maxGpusPerPod if provided (for disaggregated), otherwise assume all GPUs for one pod
  const largestPodGpus = maxGpusPerPod || selectedGpus;

  // Build deployment breakdown message for aggregated mode
  const getDeploymentBreakdown = () => {
    if (deploymentMode === 'aggregated' && replicas && gpusPerReplica) {
      return `${gpusPerReplica} GPU${gpusPerReplica > 1 ? 's' : ''} × ${replicas} replica${replicas > 1 ? 's' : ''} = ${selectedGpus} total GPU${selectedGpus > 1 ? 's' : ''}`;
    }
    return `${selectedGpus} GPU${selectedGpus > 1 ? 's' : ''}`;
  };

  const deploymentBreakdown = getDeploymentBreakdown();

  // Build multi-node info banner (rendered alongside any availability warning)
  let multiNodeBanner: React.ReactNode = null;
  if (multiNode) {
    const totalMultiNodeGpus = multiNode.totalGpus * (replicas || 1);

    // Purple info banner — will be combined with any availability warning below
    multiNodeBanner = (
      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-950/20">
        <Layers className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-800 dark:text-purple-200">
          Multi-node deployment
        </AlertTitle>
        <AlertDescription className="text-purple-700 dark:text-purple-300">
          <p>
            Model distributed across {multiNode.nodeCount} node{multiNode.nodeCount > 1 ? 's' : ''} × {multiNode.gpusPerNode} GPU{multiNode.gpusPerNode > 1 ? 's' : ''} ({multiNode.totalGpus} GPUs per replica)
          </p>
          {replicas && replicas > 1 && (
            <p className="mt-1 text-xs">
              Total: {totalMultiNodeGpus} GPUs ({replicas} replicas × {multiNode.totalGpus} GPUs)
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // No warning needed - capacity is sufficient (but still show multi-node info if present)
  if (selectedGpus <= capacity.availableGpus && largestPodGpus <= capacity.maxNodeGpuCapacity) {
    return multiNodeBanner ? <>{multiNodeBanner}</> : null;
  }

  // Red Error: Impossible to fit on any single node (skip for multi-node since it handles cross-node)
  if (!multiNode && largestPodGpus > capacity.maxNodeGpuCapacity) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Deployment exceeds available capacity</AlertTitle>
        <AlertDescription>
          <p>
            This deployment requires {largestPodGpus} GPU{largestPodGpus > 1 ? 's' : ''} per instance,
            but the largest available GPU compute resource has only {capacity.maxNodeGpuCapacity} GPU{capacity.maxNodeGpuCapacity > 1 ? 's' : ''}.
          </p>
          {deploymentMode === 'aggregated' && replicas && gpusPerReplica && (
            <p className="mt-1 text-xs">
              ({deploymentBreakdown})
            </p>
          )}
          <p className="mt-2">
            You must either:
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Reduce GPU count to {capacity.maxNodeGpuCapacity} or fewer per instance</li>
            <li>Add larger GPU compute resources</li>
          </ul>
          {capacity.nodePools.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-medium">Current resource pools:</p>
              <ul className="list-disc list-inside mt-1">
                {capacity.nodePools.map((pool) => (
                  <li key={pool.name}>
                    {pool.name}: {pool.gpuCount} GPUs across {pool.nodeCount} compute resource{pool.nodeCount > 1 ? 's' : ''}
                    {pool.gpuModel && ` (${pool.gpuModel})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <RecommendSkuButton modelId={modelId} parameterCount={parameterCount} />
        </AlertDescription>
      </Alert>
    );
  }

  // Yellow Warning: May trigger scale-up
  if (selectedGpus > capacity.availableGpus) {
    const availabilityWarning = autoscaler?.detected ? (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          System will attempt to scale up
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          <p>
            This deployment requires {deploymentBreakdown},
            but only {capacity.availableGpus} {capacity.availableGpus === 1 ? 'is' : 'are'} currently available.
          </p>
          <p className="mt-2">
            <span className="font-medium">{autoscaler.type === 'aks-managed' ? 'AKS managed autoscaler' : 'Autoscaler'}</span> is
            enabled and will attempt to scale up automatically.
          </p>
          <div className="flex items-start gap-2 mt-2 text-sm">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs">
                {capacity.availableGpus}/{capacity.totalGpus} GPUs available •
                {autoscaler.nodeGroupCount && ` ${autoscaler.nodeGroupCount} autoscaling resource pool${autoscaler.nodeGroupCount > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <RecommendSkuButton modelId={modelId} parameterCount={parameterCount} />
        </AlertDescription>
      </Alert>
    ) : (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          Insufficient GPU capacity
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          <p>
            This deployment requires {deploymentBreakdown},
            but only {capacity.availableGpus} {capacity.availableGpus === 1 ? 'is' : 'are'} currently available.
          </p>
          <p className="mt-2">
            Autoscaling is not detected. The deployment will remain pending until resources become available.
          </p>
          <div className="mt-3 text-sm">
            <a
              href="https://github.com/kaito-project/airunway/blob/main/docs/azure-autoscaling.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Learn how to enable autoscaling →
            </a>
          </div>
          <p className="text-xs mt-2">
            {capacity.availableGpus}/{capacity.totalGpus} GPUs available
          </p>
          <RecommendSkuButton modelId={modelId} parameterCount={parameterCount} />
        </AlertDescription>
      </Alert>
    );

    return (
      <>
        {multiNodeBanner}
        {availabilityWarning}
      </>
    );
  }

  return multiNodeBanner ? <>{multiNodeBanner}</> : null;
}
