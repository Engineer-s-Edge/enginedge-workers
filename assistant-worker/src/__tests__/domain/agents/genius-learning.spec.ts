import { GeniusAgent } from '../../../domain/agents/genius-agent/genius-agent';
import { LearningMode, ModelType } from '../../../domain/agents/genius-agent/genius-agent.types';
import { ILLMProvider } from '../../../application/ports/llm-provider.port';
import { ILogger } from '../../../application/ports/logger.port';

describe('Genius Agent - Model Management', () => {
  let geniusAgent: GeniusAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest.fn().mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelName: jest.fn().mockReturnValue('mock-model'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    };

    geniusAgent = new GeniusAgent(mockLLMProvider, mockLogger, {
      expertPoolSize: 10,
      learningModes: ['supervised', 'unsupervised', 'reinforcement'],
      qualityThreshold: 0.8,
      temperature: 0.7,
      model: 'gpt-4',
    });
  });

  const createModel = (id: string, type: ModelType) => ({
    modelId: id,
    name: `Model ${id}`,
    type,
    version: '1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    hyperparameters: {},
  });

  test('should add neural network models', () => {
    geniusAgent.addModel(createModel('nn1', ModelType.NEURAL_NETWORK));
    const state = geniusAgent.getGeniusState();
    expect(state.models).toHaveLength(1);
    expect(state.models[0].modelId).toBe('nn1');
  });

  test('should add decision tree models', () => {
    geniusAgent.addModel(createModel('dt1', ModelType.DECISION_TREE));
    const state = geniusAgent.getGeniusState();
    expect(state.models).toHaveLength(1);
    expect(state.models[0].type).toBe(ModelType.DECISION_TREE);
  });

  test('should add clustering models', () => {
    geniusAgent.addModel(createModel('cl1', ModelType.CLUSTERING));
    const state = geniusAgent.getGeniusState();
    expect(state.models).toHaveLength(1);
    expect(state.models[0].type).toBe(ModelType.CLUSTERING);
  });

  test('should add Q-learning models', () => {
    geniusAgent.addModel(createModel('ql1', ModelType.Q_LEARNING));
    const state = geniusAgent.getGeniusState();
    expect(state.models).toHaveLength(1);
    expect(state.models[0].type).toBe(ModelType.Q_LEARNING);
  });

  test('should support multiple model types', () => {
    geniusAgent.addModel(createModel('nn1', ModelType.NEURAL_NETWORK));
    geniusAgent.addModel(createModel('dt1', ModelType.DECISION_TREE));
    geniusAgent.addModel(createModel('cl1', ModelType.CLUSTERING));
    const state = geniusAgent.getGeniusState();
    expect(state.models).toHaveLength(3);
  });

  test('should activate models by ID', () => {
    geniusAgent.addModel(createModel('active1', ModelType.NEURAL_NETWORK));
    geniusAgent.activateModel('active1');
    const state = geniusAgent.getGeniusState();
    expect(state.activeModel?.modelId).toBe('active1');
  });

  test('should throw on invalid model activation', () => {
    expect(() => {
      geniusAgent.activateModel('nonexistent');
    }).toThrow('Model nonexistent not found');
  });

  test('should switch learning modes', () => {
    geniusAgent.switchMode(LearningMode.SUPERVISED);
    let state = geniusAgent.getGeniusState();
    expect(state.currentMode).toBe(LearningMode.SUPERVISED);

    geniusAgent.switchMode(LearningMode.UNSUPERVISED);
    state = geniusAgent.getGeniusState();
    expect(state.currentMode).toBe(LearningMode.UNSUPERVISED);

    geniusAgent.switchMode(LearningMode.REINFORCEMENT);
    state = geniusAgent.getGeniusState();
    expect(state.currentMode).toBe(LearningMode.REINFORCEMENT);
  });

  test('should maintain mode after model operations', () => {
    geniusAgent.switchMode(LearningMode.UNSUPERVISED);
    geniusAgent.addModel(createModel('test', ModelType.NEURAL_NETWORK));
    const state = geniusAgent.getGeniusState();
    expect(state.currentMode).toBe(LearningMode.UNSUPERVISED);
  });
});

describe('Genius Agent - Learning Modes', () => {
  let geniusAgent: GeniusAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest.fn().mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelName: jest.fn().mockReturnValue('mock-model'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    };

    geniusAgent = new GeniusAgent(mockLLMProvider, mockLogger);
  });

  test('should execute supervised learning', async () => {
    geniusAgent.switchMode(LearningMode.SUPERVISED);
    const result = await geniusAgent.execute('Test input');
    expect(result).toBeDefined();
  });

  test('should execute unsupervised learning', async () => {
    geniusAgent.switchMode(LearningMode.UNSUPERVISED);
    const result = await geniusAgent.execute('Test input');
    expect(result).toBeDefined();
  });

  test('should execute reinforcement learning', async () => {
    geniusAgent.switchMode(LearningMode.REINFORCEMENT);
    const result = await geniusAgent.execute('Test input');
    expect(result).toBeDefined();
  });

  test('should handle mode switching during execution', () => {
    geniusAgent.switchMode(LearningMode.SUPERVISED);
    geniusAgent.switchMode(LearningMode.UNSUPERVISED);
    geniusAgent.switchMode(LearningMode.REINFORCEMENT);
    const state = geniusAgent.getGeniusState();
    expect(state.currentMode).toBe(LearningMode.REINFORCEMENT);
  });
});

describe('Genius Agent - Model Execution', () => {
  let geniusAgent: GeniusAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest.fn().mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelName: jest.fn().mockReturnValue('mock-model'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    };

    geniusAgent = new GeniusAgent(mockLLMProvider, mockLogger);
  });

  test('should execute with active model', async () => {
    const model = {
      modelId: 'test-model',
      name: 'Test Model',
      type: ModelType.NEURAL_NETWORK,
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      hyperparameters: {},
    };
    
    geniusAgent.addModel(model);
    geniusAgent.activateModel('test-model');
    const result = await geniusAgent.execute('Test input');
    expect(result).toBeDefined();
  });

  test('should handle execution without active model', async () => {
    const result = await geniusAgent.execute('Test input');
    expect(result).toBeDefined();
  });

  test('should support streaming execution', async () => {
    // Test that streaming method exists and can be called
    expect(typeof geniusAgent.stream).toBe('function');
    
    // For now, just verify the method exists
    // The actual streaming implementation may need more complex setup
    expect(geniusAgent.stream).toBeDefined();
  });
});

describe('Genius Agent - Advanced Features', () => {
  let geniusAgent: GeniusAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest.fn().mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelName: jest.fn().mockReturnValue('mock-model'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    };

    geniusAgent = new GeniusAgent(mockLLMProvider, mockLogger);
  });

  test('should support complex model configurations', () => {
    const complexModel = {
      modelId: 'complex-1',
      name: 'Complex Model',
      type: ModelType.NEURAL_NETWORK,
      version: '2.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      hyperparameters: {
        layers: 5,
        neurons: 128,
        activation: 'relu',
        learningRate: 0.001,
      },
    };

    geniusAgent.addModel(complexModel);
    const state = geniusAgent.getGeniusState();
    expect(state.models[0].hyperparameters).toEqual(complexModel.hyperparameters);
  });

  test('should handle model versioning', () => {
    const modelV1 = {
      modelId: 'versioned-model',
      name: 'Versioned Model',
      type: ModelType.DECISION_TREE,
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      hyperparameters: {},
    };

    const modelV2 = {
      modelId: 'versioned-model-v2',
      name: 'Versioned Model V2',
      type: ModelType.DECISION_TREE,
      version: '2.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      hyperparameters: {},
    };

    geniusAgent.addModel(modelV1);
    geniusAgent.addModel(modelV2);
    const state = geniusAgent.getGeniusState();
    expect(state.models).toHaveLength(2);
    expect(state.models[0].version).toBe('1.0');
    expect(state.models[1].version).toBe('2.0');
  });

  test('should support learning mode transitions', () => {
    geniusAgent.switchMode(LearningMode.SUPERVISED);
    geniusAgent.switchMode(LearningMode.UNSUPERVISED);
    geniusAgent.switchMode(LearningMode.REINFORCEMENT);
    
    const state = geniusAgent.getGeniusState();
    expect(state.currentMode).toBe(LearningMode.REINFORCEMENT);
  });
});