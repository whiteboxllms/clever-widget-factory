/**
 * Inventory module entry point
 * Combines InventoryService and RDS integration for complete inventory management
 */

import { InventoryService } from './InventoryService';
import { RDSIntegration } from './RDSIntegration';
import { logger } from '@/utils/logger';
import { DatabaseError } from '@/utils/errors';

export { InventoryService } from './InventoryService';
export { RDSIntegration } from './RDSIntegration';

/**
 * Integrated Inventory Manager
 * Provides a unified interface for all inventory operations
 */
export class IntegratedInventoryManager {
  private inventoryService: InventoryService;
  private rdsIntegration: RDSIntegration;
  private initialized = false;

  constructor() {
    this.inventoryService = new InventoryService();
    this.rdsIntegration = new RDSIntegration({
      enableSafeMode: true,
      fallbackToCache: true,
      validateSchema: true
    });
  }

  /**
   * Initialize the integrated inventory system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing integrated inventory system');

      // Initialize RDS integration first
      await this.rdsIntegration.initialize();

      // Test compatibility with existing farm systems
      const compatibility = await this.rdsIntegration.testCompatibility();
      
      if (!compatibility.compatible) {
        logger.warn('Compatibility issues detected', { 
          issues: compatibility.issues,
          recommendations: compatibility.recommendations 
        });
        
        // In production, you might want to fail here or require manual approval
        if (compatibility.issues.some(issue => issue.includes('failed'))) {
          throw new DatabaseError(`Critical compatibility issues: ${compatibility.issues.join(', ')}`);
        }
      }

      this.initialized = true;
      logger.info('Integrated inventory system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize integrated inventory system', error);
      throw error;
    }
  }

  /**
   * Get the inventory service instance
   */
  getInventoryService(): InventoryService {
    if (!this.initialized) {
      throw new Error('Inventory system not initialized. Call initialize() first.');
    }
    return this.inventoryService;
  }

  /**
   * Get the RDS integration instance
   */
  getRDSIntegration(): RDSIntegration {
    if (!this.initialized) {
      throw new Error('Inventory system not initialized. Call initialize() first.');
    }
    return this.rdsIntegration;
  }

  /**
   * Health check for the entire inventory system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    inventoryService: boolean;
    rdsIntegration: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let inventoryServiceHealthy = true;
    let rdsIntegrationHealthy = true;

    try {
      // Check RDS integration
      const rdsStatus = this.rdsIntegration.getStatus();
      if (!rdsStatus.initialized) {
        rdsIntegrationHealthy = false;
        issues.push('RDS integration not initialized');
      }

      // Test basic inventory operations
      try {
        await this.inventoryService.getSellableProducts();
      } catch (error) {
        inventoryServiceHealthy = false;
        issues.push(`Inventory service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test RDS compatibility
      if (rdsIntegrationHealthy) {
        const compatibility = await this.rdsIntegration.testCompatibility();
        if (!compatibility.compatible) {
          issues.push(...compatibility.issues);
        }
      }

    } catch (error) {
      issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const healthy = inventoryServiceHealthy && rdsIntegrationHealthy && issues.length === 0;

    return {
      healthy,
      inventoryService: inventoryServiceHealthy,
      rdsIntegration: rdsIntegrationHealthy,
      issues
    };
  }

  /**
   * Get system status and metrics
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    rdsStatus: any;
    productCount: number;
    sellableProductCount: number;
    lowStockCount: number;
    lastHealthCheck: Date;
  }> {
    const healthCheck = await this.healthCheck();
    
    let productCount = 0;
    let sellableProductCount = 0;
    let lowStockCount = 0;

    try {
      if (healthCheck.healthy) {
        const allProducts = await this.inventoryService.getAvailableProducts();
        productCount = allProducts.length;

        const sellableProducts = await this.inventoryService.getSellableProducts();
        sellableProductCount = sellableProducts.length;

        const lowStockProducts = await this.inventoryService.getLowStockProducts();
        lowStockCount = lowStockProducts.length;
      }
    } catch (error) {
      logger.warn('Failed to get product counts for status', error);
    }

    return {
      initialized: this.initialized,
      rdsStatus: this.rdsIntegration.getStatus(),
      productCount,
      sellableProductCount,
      lowStockCount,
      lastHealthCheck: new Date()
    };
  }

  /**
   * Cleanup expired reservations and perform maintenance
   */
  async performMaintenance(): Promise<{
    expiredReservationsCleared: number;
    maintenanceCompleted: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let expiredReservationsCleared = 0;

    try {
      logger.info('Starting inventory maintenance');

      // Clean up expired reservations
      expiredReservationsCleared = await this.inventoryService.cleanupExpiredReservations();

      // Additional maintenance tasks could go here
      // - Update product freshness indicators
      // - Generate low stock alerts
      // - Sync with external systems

      logger.info('Inventory maintenance completed', { 
        expiredReservationsCleared 
      });

      return {
        expiredReservationsCleared,
        maintenanceCompleted: true,
        issues
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      issues.push(`Maintenance failed: ${errorMessage}`);
      
      logger.error('Inventory maintenance failed', error);

      return {
        expiredReservationsCleared,
        maintenanceCompleted: false,
        issues
      };
    }
  }
}

// Export singleton instance
export const integratedInventoryManager = new IntegratedInventoryManager();

// Convenience exports for direct access
export const inventoryService = new InventoryService();
export const rdsIntegration = new RDSIntegration();