/**
 * MathJax Service - Simplified Version
 * Backward compatibility wrapper for the new SimpleMathJaxService
 */

import { simpleMathJaxService } from './simple-mathjax-service.js';

// Export the simplified service as the main service for backward compatibility
export const mathJaxService = simpleMathJaxService;
export const MathJaxService = class {
    constructor() {
        return simpleMathJaxService;
    }
};

// Default export
export default simpleMathJaxService;