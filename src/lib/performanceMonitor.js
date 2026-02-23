/**
 * Performance Monitor
 * Tracks CPU and memory usage to help diagnose performance issues
 * Particularly useful for detecting memory leaks and high CPU usage on Windows
 */

export class PerformanceMonitor {
  constructor(log) {
    this.log = log;
    this.scanMetrics = [];
    this.appStartTime = Date.now();
    this.appStartMemory = process.memoryUsage();
  }

  /**
   * Start tracking a scan operation
   * @returns {Object} Scan start metrics
   */
  startScan() {
    return {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      startCPU: process.cpuUsage(),
    };
  }

  /**
   * End tracking a scan operation and log metrics
   * @param {Object} scanStart - Metrics from startScan()
   * @returns {Object} Complete scan metrics
   */
  endScan(scanStart) {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const endCPU = process.cpuUsage(scanStart.startCPU);

    const metrics = {
      duration: endTime - scanStart.startTime,
      memoryDelta: {
        rss: endMemory.rss - scanStart.startMemory.rss,
        heapUsed: endMemory.heapUsed - scanStart.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - scanStart.startMemory.heapTotal,
        external: endMemory.external - scanStart.startMemory.external,
      },
      memoryAbsolute: {
        rss: endMemory.rss,
        heapUsed: endMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external,
      },
      cpuUsage: {
        user: Math.round(endCPU.user / 1000), // microseconds to milliseconds
        system: Math.round(endCPU.system / 1000),
        total: Math.round((endCPU.user + endCPU.system) / 1000),
      },
      timestamp: new Date().toISOString(),
      platform: process.platform,
    };

    this.scanMetrics.push(metrics);

    // Keep only last 20 scans to prevent unbounded memory growth
    if (this.scanMetrics.length > 20) {
      this.scanMetrics.shift();
    }

    // Log warnings for concerning metrics
    const heapGrowthMB = metrics.memoryDelta.heapUsed / 1024 / 1024;
    const rssGrowthMB = metrics.memoryDelta.rss / 1024 / 1024;
    const totalHeapMB = metrics.memoryAbsolute.heapUsed / 1024 / 1024;
    const totalRssMB = metrics.memoryAbsolute.rss / 1024 / 1024;

    // Warn if memory growth is significant (>50MB heap growth per scan)
    if (heapGrowthMB > 50) {
      this.log.warn(
        `High heap memory growth detected: +${heapGrowthMB.toFixed(2)}MB (total: ${totalHeapMB.toFixed(2)}MB)`
      );
    }

    // Warn if RSS growth is significant (>100MB RSS growth per scan)
    if (rssGrowthMB > 100) {
      this.log.warn(
        `High RSS memory growth detected: +${rssGrowthMB.toFixed(2)}MB (total: ${totalRssMB.toFixed(2)}MB)`
      );
    }

    // Warn if CPU usage during scan is excessive (>5 seconds)
    if (metrics.cpuUsage.total > 5000) {
      this.log.warn(
        `High CPU usage during scan: ${metrics.cpuUsage.total}ms (user: ${metrics.cpuUsage.user}ms, system: ${metrics.cpuUsage.system}ms)`
      );
    }

    // Log info-level metrics for normal scans
    this.log.info('Scan performance', {
      duration: `${metrics.duration}ms`,
      heapGrowth: `${heapGrowthMB.toFixed(2)}MB`,
      totalHeap: `${totalHeapMB.toFixed(2)}MB`,
      cpuTime: `${metrics.cpuUsage.total}ms`,
    });

    return metrics;
  }

  /**
   * Get all collected metrics
   * @returns {Array} Array of scan metrics
   */
  getMetrics() {
    return this.scanMetrics;
  }

  /**
   * Get summary statistics across all scans
   * @returns {Object} Summary statistics
   */
  getSummary() {
    if (this.scanMetrics.length === 0) {
      return {
        scanCount: 0,
        message: 'No scans performed yet',
      };
    }

    const heapGrowths = this.scanMetrics.map(m => m.memoryDelta.heapUsed);
    const durations = this.scanMetrics.map(m => m.duration);
    const cpuTotals = this.scanMetrics.map(m => m.cpuUsage.total);

    const avgHeapGrowth = heapGrowths.reduce((a, b) => a + b, 0) / heapGrowths.length;
    const maxHeapGrowth = Math.max(...heapGrowths);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const avgCPU = cpuTotals.reduce((a, b) => a + b, 0) / cpuTotals.length;
    const maxCPU = Math.max(...cpuTotals);

    const currentMemory = process.memoryUsage();
    const uptimeMs = Date.now() - this.appStartTime;

    return {
      scanCount: this.scanMetrics.length,
      uptime: {
        ms: uptimeMs,
        hours: (uptimeMs / 1000 / 60 / 60).toFixed(2),
      },
      memory: {
        current: {
          rss: `${(currentMemory.rss / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        },
        avgGrowthPerScan: `${(avgHeapGrowth / 1024 / 1024).toFixed(2)}MB`,
        maxGrowthPerScan: `${(maxHeapGrowth / 1024 / 1024).toFixed(2)}MB`,
      },
      performance: {
        avgScanDuration: `${avgDuration.toFixed(0)}ms`,
        maxScanDuration: `${maxDuration.toFixed(0)}ms`,
        avgCPUTime: `${avgCPU.toFixed(0)}ms`,
        maxCPUTime: `${maxCPU.toFixed(0)}ms`,
      },
      platform: process.platform,
    };
  }

  /**
   * Log the performance summary
   */
  logSummary() {
    const summary = this.getSummary();
    this.log.info('Performance Summary', summary);
    return summary;
  }
}

export default PerformanceMonitor;
