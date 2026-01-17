/**
 * Efficiency Metrics Value Object
 *
 * Represents efficiency metrics for schedule analysis
 *
 * Domain Value Object - Immutable, no infrastructure dependencies
 */

export class EfficiencyMetrics {
  constructor(
    public readonly scheduleEfficiency: number, // 0-1
    public readonly timeUtilization: number, // 0-1
    public readonly completionRate: number, // 0-1
    public readonly punctualityRate: number, // 0-1
    public readonly productivityScore: number, // 0-1
    public readonly averageDelay: number, // minutes
    public readonly rescheduleFrequency: number, // events per week
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.scheduleEfficiency < 0 || this.scheduleEfficiency > 1) {
      throw new Error('Schedule efficiency must be between 0 and 1');
    }
    if (this.timeUtilization < 0 || this.timeUtilization > 1) {
      throw new Error('Time utilization must be between 0 and 1');
    }
    if (this.completionRate < 0 || this.completionRate > 1) {
      throw new Error('Completion rate must be between 0 and 1');
    }
    if (this.punctualityRate < 0 || this.punctualityRate > 1) {
      throw new Error('Punctuality rate must be between 0 and 1');
    }
    if (this.productivityScore < 0 || this.productivityScore > 1) {
      throw new Error('Productivity score must be between 0 and 1');
    }
    if (this.averageDelay < 0) {
      throw new Error('Average delay must be non-negative');
    }
    if (this.rescheduleFrequency < 0) {
      throw new Error('Reschedule frequency must be non-negative');
    }
  }

  /**
   * Get overall efficiency score (weighted average)
   */
  getOverallEfficiency(): number {
    // Weighted average with schedule efficiency and completion rate having higher weight
    return (
      this.scheduleEfficiency * 0.3 +
      this.completionRate * 0.3 +
      this.timeUtilization * 0.15 +
      this.punctualityRate * 0.15 +
      this.productivityScore * 0.1
    );
  }

  /**
   * Check if metrics indicate good performance
   */
  isGoodPerformance(threshold: number = 0.7): boolean {
    return this.getOverallEfficiency() >= threshold;
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      scheduleEfficiency: this.scheduleEfficiency,
      timeUtilization: this.timeUtilization,
      completionRate: this.completionRate,
      punctualityRate: this.punctualityRate,
      productivityScore: this.productivityScore,
      averageDelay: this.averageDelay,
      rescheduleFrequency: this.rescheduleFrequency,
      overallEfficiency: this.getOverallEfficiency(),
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): EfficiencyMetrics {
    return new EfficiencyMetrics(
      obj.scheduleEfficiency || 0,
      obj.timeUtilization || 0,
      obj.completionRate || 0,
      obj.punctualityRate || 0,
      obj.productivityScore || 0,
      obj.averageDelay || 0,
      obj.rescheduleFrequency || 0,
    );
  }
}
