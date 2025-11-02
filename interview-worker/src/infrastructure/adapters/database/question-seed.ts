/**
 * Question Bank Seed Data
 * 
 * Provides 50+ sample questions for the question bank.
 * These questions cover all categories and difficulty levels.
 */

import { InterviewQuestion } from '../../../domain/entities';

export const SEED_QUESTIONS: Omit<
  InterviewQuestion,
  'matches' | 'toObject' | 'fromObject'
>[] = [
  // Behavioral Questions
  {
    questionId: 'beh-001',
    category: 'behavioral',
    subcategory: 'conflict-resolution',
    difficulty: 'easy',
    tags: ['teamwork', 'communication'],
    question:
      'Tell me about a time when you had to resolve a conflict with a team member. How did you handle it?',
    expectedDuration: 5,
  },
  {
    questionId: 'beh-002',
    category: 'behavioral',
    subcategory: 'leadership',
    difficulty: 'medium',
    tags: ['leadership', 'management'],
    question:
      'Describe a situation where you had to lead a team without formal authority. What challenges did you face?',
    expectedDuration: 7,
  },
  {
    questionId: 'beh-003',
    category: 'behavioral',
    subcategory: 'failure',
    difficulty: 'medium',
    tags: ['learning', 'resilience'],
    question:
      'Tell me about a time when you failed at something important. What did you learn from it?',
    expectedDuration: 6,
  },
  {
    questionId: 'beh-004',
    category: 'behavioral',
    subcategory: 'prioritization',
    difficulty: 'hard',
    tags: ['time-management', 'decision-making'],
    question:
      'Describe a situation where you had multiple urgent deadlines. How did you prioritize and manage your time?',
    expectedDuration: 8,
  },
  {
    questionId: 'beh-005',
    category: 'behavioral',
    subcategory: 'innovation',
    difficulty: 'medium',
    tags: ['creativity', 'problem-solving'],
    question:
      'Give me an example of when you came up with an innovative solution to a problem.',
    expectedDuration: 6,
  },

  // Tech Trivia Questions
  {
    questionId: 'tech-001',
    category: 'tech-trivia',
    subcategory: 'javascript',
    difficulty: 'easy',
    tags: ['javascript', 'fundamentals'],
    question:
      'What is the difference between let, const, and var in JavaScript?',
    expectedDuration: 3,
  },
  {
    questionId: 'tech-002',
    category: 'tech-trivia',
    subcategory: 'javascript',
    difficulty: 'medium',
    tags: ['javascript', 'closures'],
    question: 'Explain closures in JavaScript and provide an example.',
    expectedDuration: 5,
  },
  {
    questionId: 'tech-003',
    category: 'tech-trivia',
    subcategory: 'typescript',
    difficulty: 'easy',
    tags: ['typescript', 'types'],
    question:
      'What are the main benefits of TypeScript over JavaScript?',
    expectedDuration: 3,
  },
  {
    questionId: 'tech-004',
    category: 'tech-trivia',
    subcategory: 'databases',
    difficulty: 'medium',
    tags: ['database', 'sql'],
    question:
      'Explain the difference between SQL JOIN types: INNER, LEFT, RIGHT, and FULL OUTER.',
    expectedDuration: 5,
  },
  {
    questionId: 'tech-005',
    category: 'tech-trivia',
    subcategory: 'http',
    difficulty: 'easy',
    tags: ['http', 'web'],
    question:
      'What is the difference between HTTP GET and POST methods?',
    expectedDuration: 3,
  },
  {
    questionId: 'tech-006',
    category: 'tech-trivia',
    subcategory: 'http',
    difficulty: 'medium',
    tags: ['http', 'rest'],
    question:
      'Explain RESTful API principles. What makes an API RESTful?',
    expectedDuration: 6,
  },
  {
    questionId: 'tech-007',
    category: 'tech-trivia',
    subcategory: 'security',
    difficulty: 'medium',
    tags: ['security', 'authentication'],
    question:
      'What is the difference between authentication and authorization?',
    expectedDuration: 4,
  },
  {
    questionId: 'tech-008',
    category: 'tech-trivia',
    subcategory: 'security',
    difficulty: 'hard',
    tags: ['security', 'cryptography'],
    question:
      'Explain how JWT (JSON Web Tokens) work and what security considerations should be taken?',
    expectedDuration: 7,
  },
  {
    questionId: 'tech-009',
    category: 'tech-trivia',
    subcategory: 'docker',
    difficulty: 'medium',
    tags: ['docker', 'devops'],
    question:
      'What is the difference between a Docker image and a Docker container?',
    expectedDuration: 4,
  },
  {
    questionId: 'tech-010',
    category: 'tech-trivia',
    subcategory: 'git',
    difficulty: 'easy',
    tags: ['git', 'version-control'],
    question:
      'Explain the difference between git merge and git rebase.',
    expectedDuration: 4,
  },

  // System Design Questions
  {
    questionId: 'sys-001',
    category: 'system-design',
    subcategory: 'scalability',
    difficulty: 'medium',
    tags: ['scalability', 'architecture'],
    question:
      'How would you design a URL shortener like bit.ly that can handle millions of requests per day?',
    expectedDuration: 20,
  },
  {
    questionId: 'sys-002',
    category: 'system-design',
    subcategory: 'caching',
    difficulty: 'hard',
    tags: ['caching', 'performance'],
    question:
      'Design a distributed caching system. How would you handle cache invalidation and consistency?',
    expectedDuration: 25,
  },
  {
    questionId: 'sys-003',
    category: 'system-design',
    subcategory: 'messaging',
    difficulty: 'hard',
    tags: ['messaging', 'queues'],
    question:
      'Design a message queue system that guarantees at-least-once delivery. How would you handle failures?',
    expectedDuration: 25,
  },
  {
    questionId: 'sys-004',
    category: 'system-design',
    subcategory: 'databases',
    difficulty: 'medium',
    tags: ['database', 'scalability'],
    question:
      'How would you design a database schema for a social media platform with millions of users?',
    expectedDuration: 20,
  },
  {
    questionId: 'sys-005',
    category: 'system-design',
    subcategory: 'search',
    difficulty: 'hard',
    tags: ['search', 'indexing'],
    question:
      'Design a search engine that can index and search billions of documents efficiently.',
    expectedDuration: 30,
  },
  {
    questionId: 'sys-006',
    category: 'system-design',
    subcategory: 'load-balancing',
    difficulty: 'medium',
    tags: ['load-balancing', 'high-availability'],
    question:
      'Explain different load balancing strategies and when to use each one.',
    expectedDuration: 10,
  },
  {
    questionId: 'sys-007',
    category: 'system-design',
    subcategory: 'microservices',
    difficulty: 'hard',
    tags: ['microservices', 'architecture'],
    question:
      'How would you design a microservices architecture? What are the key challenges and how would you address them?',
    expectedDuration: 25,
  },

  // Coding Questions - Arrays
  {
    questionId: 'code-001',
    category: 'coding',
    subcategory: 'arrays',
    difficulty: 'easy',
    tags: ['arrays', 'two-pointers'],
    question:
      'Given an array of integers, find two numbers that add up to a target sum. Return their indices.',
    expectedDuration: 15,
  },
  {
    questionId: 'code-002',
    category: 'coding',
    subcategory: 'arrays',
    difficulty: 'medium',
    tags: ['arrays', 'sliding-window'],
    question:
      'Given an array of positive integers and a target sum, find the length of the smallest contiguous subarray with a sum greater than or equal to the target.',
    expectedDuration: 20,
  },
  {
    questionId: 'code-003',
    category: 'coding',
    subcategory: 'arrays',
    difficulty: 'hard',
    tags: ['arrays', 'dynamic-programming'],
    question:
      'Given an array of integers representing the values of houses on a street, find the maximum value you can rob without robbing two adjacent houses.',
    expectedDuration: 25,
  },
  {
    questionId: 'code-004',
    category: 'coding',
    subcategory: 'arrays',
    difficulty: 'medium',
    tags: ['arrays', 'sorting'],
    question:
      'Given an array of intervals, merge all overlapping intervals.',
    expectedDuration: 20,
  },

  // Coding Questions - Trees
  {
    questionId: 'code-005',
    category: 'coding',
    subcategory: 'tree',
    difficulty: 'easy',
    tags: ['tree', 'binary-tree'],
    question:
      'Given a binary tree, find the maximum depth (height) of the tree.',
    expectedDuration: 10,
  },
  {
    questionId: 'code-006',
    category: 'coding',
    subcategory: 'tree',
    difficulty: 'medium',
    tags: ['tree', 'traversal'],
    question:
      'Given a binary tree, return the inorder traversal of its nodes values.',
    expectedDuration: 15,
  },
  {
    questionId: 'code-007',
    category: 'coding',
    subcategory: 'tree',
    difficulty: 'hard',
    tags: ['tree', 'binary-search-tree'],
    question:
      'Given a binary search tree, validate that it is a valid BST (all left children are less than parent, all right children are greater).',
    expectedDuration: 20,
  },

  // Coding Questions - Graphs
  {
    questionId: 'code-008',
    category: 'coding',
    subcategory: 'graph',
    difficulty: 'medium',
    tags: ['graph', 'bfs'],
    question:
      'Given a graph represented as an adjacency list, implement breadth-first search (BFS) to find the shortest path between two nodes.',
    expectedDuration: 20,
  },
  {
    questionId: 'code-009',
    category: 'coding',
    subcategory: 'graph',
    difficulty: 'hard',
    tags: ['graph', 'dfs'],
    question:
      'Given a directed graph, determine if there is a cycle in the graph using depth-first search.',
    expectedDuration: 25,
  },
  {
    questionId: 'code-010',
    category: 'coding',
    subcategory: 'graph',
    difficulty: 'hard',
    tags: ['graph', 'shortest-path'],
    question:
      'Implement Dijkstra\'s algorithm to find the shortest path between two nodes in a weighted graph.',
    expectedDuration: 30,
  },

  // Coding Questions - Dynamic Programming
  {
    questionId: 'code-011',
    category: 'coding',
    subcategory: 'dynamic-programming',
    difficulty: 'medium',
    tags: ['dynamic-programming', 'memoization'],
    question:
      'Given n, calculate the nth Fibonacci number using dynamic programming (both iterative and recursive with memoization approaches).',
    expectedDuration: 15,
  },
  {
    questionId: 'code-012',
    category: 'coding',
    subcategory: 'dynamic-programming',
    difficulty: 'hard',
    tags: ['dynamic-programming', 'knapsack'],
    question:
      'Solve the 0/1 knapsack problem: given items with weights and values, find the maximum value you can carry in a knapsack of capacity W.',
    expectedDuration: 30,
  },
  {
    questionId: 'code-013',
    category: 'coding',
    subcategory: 'dynamic-programming',
    difficulty: 'medium',
    tags: ['dynamic-programming', 'strings'],
    question:
      'Given two strings, find the length of the longest common subsequence (LCS).',
    expectedDuration: 25,
  },

  // Coding Questions - Strings
  {
    questionId: 'code-014',
    category: 'coding',
    subcategory: 'string',
    difficulty: 'easy',
    tags: ['string', 'palindrome'],
    question:
      'Check if a string is a palindrome (reads the same forwards and backwards).',
    expectedDuration: 10,
  },
  {
    questionId: 'code-015',
    category: 'coding',
    subcategory: 'string',
    difficulty: 'medium',
    tags: ['string', 'anagram'],
    question:
      'Given two strings, determine if they are anagrams of each other.',
    expectedDuration: 12,
  },
  {
    questionId: 'code-016',
    category: 'coding',
    subcategory: 'string',
    difficulty: 'hard',
    tags: ['string', 'sliding-window'],
    question:
      'Given a string, find the length of the longest substring without repeating characters.',
    expectedDuration: 20,
  },

  // Coding Questions - Linked Lists
  {
    questionId: 'code-017',
    category: 'coding',
    subcategory: 'linked-list',
    difficulty: 'easy',
    tags: ['linked-list', 'pointers'],
    question:
      'Given a singly linked list, reverse the list and return the new head.',
    expectedDuration: 15,
  },
  {
    questionId: 'code-018',
    category: 'coding',
    subcategory: 'linked-list',
    difficulty: 'medium',
    tags: ['linked-list', 'two-pointers'],
    question:
      'Given a linked list, determine if it has a cycle using Floyd\'s cycle detection algorithm.',
    expectedDuration: 18,
  },
  {
    questionId: 'code-019',
    category: 'coding',
    subcategory: 'linked-list',
    difficulty: 'hard',
    tags: ['linked-list', 'merge'],
    question:
      'Merge k sorted linked lists into one sorted linked list. Optimize for time complexity.',
    expectedDuration: 25,
  },

  // Coding Questions - Stacks and Queues
  {
    questionId: 'code-020',
    category: 'coding',
    subcategory: 'stack',
    difficulty: 'easy',
    tags: ['stack', 'parentheses'],
    question:
      'Given a string containing just parentheses, determine if the input string is valid (each opening has a corresponding closing).',
    expectedDuration: 12,
  },
  {
    questionId: 'code-021',
    category: 'coding',
    subcategory: 'stack',
    difficulty: 'medium',
    tags: ['stack', 'monotonic'],
    question:
      'Given an array of integers, find the next greater element for each element (first element to the right that is greater).',
    expectedDuration: 20,
  },
  {
    questionId: 'code-022',
    category: 'coding',
    subcategory: 'heap',
    difficulty: 'medium',
    tags: ['heap', 'priority-queue'],
    question:
      'Find the k largest elements in an array using a min-heap or max-heap.',
    expectedDuration: 18,
  },

  // More Behavioral Questions
  {
    questionId: 'beh-006',
    category: 'behavioral',
    subcategory: 'teamwork',
    difficulty: 'easy',
    tags: ['teamwork', 'collaboration'],
    question:
      'Tell me about a time when you had to work closely with someone whose personality was very different from yours.',
    expectedDuration: 5,
  },
  {
    questionId: 'beh-007',
    category: 'behavioral',
    subcategory: 'communication',
    difficulty: 'medium',
    tags: ['communication', 'stakeholder'],
    question:
      'Describe a situation where you had to explain a complex technical concept to a non-technical stakeholder.',
    expectedDuration: 6,
  },
  {
    questionId: 'beh-008',
    category: 'behavioral',
    subcategory: 'adaptability',
    difficulty: 'medium',
    tags: ['adaptability', 'change'],
    question:
      'Tell me about a time when you had to adapt quickly to a major change in your project or team.',
    expectedDuration: 6,
  },
  {
    questionId: 'beh-009',
    category: 'behavioral',
    subcategory: 'problem-solving',
    difficulty: 'hard',
    tags: ['problem-solving', 'critical-thinking'],
    question:
      'Describe a challenging technical problem you solved. Walk me through your thought process.',
    expectedDuration: 10,
  },
  {
    questionId: 'beh-010',
    category: 'behavioral',
    subcategory: 'feedback',
    difficulty: 'medium',
    tags: ['feedback', 'growth'],
    question:
      'Tell me about a time when you received difficult feedback. How did you handle it?',
    expectedDuration: 5,
  },

  // More Tech Trivia
  {
    questionId: 'tech-011',
    category: 'tech-trivia',
    subcategory: 'react',
    difficulty: 'medium',
    tags: ['react', 'frontend'],
    question:
      'Explain the React component lifecycle and the difference between functional and class components.',
    expectedDuration: 7,
  },
  {
    questionId: 'tech-012',
    category: 'tech-trivia',
    subcategory: 'nodejs',
    difficulty: 'medium',
    tags: ['nodejs', 'event-loop'],
    question:
      'Explain the Node.js event loop. How does it handle asynchronous operations?',
    expectedDuration: 8,
  },
  {
    questionId: 'tech-013',
    category: 'tech-trivia',
    subcategory: 'testing',
    difficulty: 'easy',
    tags: ['testing', 'quality'],
    question:
      'What is the difference between unit tests, integration tests, and end-to-end tests?',
    expectedDuration: 5,
  },
  {
    questionId: 'tech-014',
    category: 'tech-trivia',
    subcategory: 'algorithms',
    difficulty: 'hard',
    tags: ['algorithms', 'complexity'],
    question:
      'Explain Big O notation and provide examples of O(1), O(n), O(log n), and O(n²) algorithms.',
    expectedDuration: 10,
  },
  {
    questionId: 'tech-015',
    category: 'tech-trivia',
    subcategory: 'design-patterns',
    difficulty: 'medium',
    tags: ['design-patterns', 'oop'],
    question:
      'Explain the Singleton, Factory, and Observer design patterns. When would you use each?',
    expectedDuration: 10,
  },
];

/**
 * Convert seed data to InterviewQuestion entities
 */
export function createSeedQuestions(): InterviewQuestion[] {
  return SEED_QUESTIONS.map(
    (q) =>
      new InterviewQuestion({
        questionId: q.questionId,
        category: q.category,
        subcategory: q.subcategory,
        difficulty: q.difficulty,
        tags: q.tags,
        question: q.question,
        expectedDuration: q.expectedDuration,
      }),
  );
}

