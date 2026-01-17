import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// User data schema (simplified - in production, this might be in identity-worker)
interface UserResumeData {
  userId: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  lastUpdated: Date;
}

@Injectable()
export class UserDataService {
  private readonly logger = new Logger(UserDataService.name);
  // In-memory storage (in production, use MongoDB or identity-worker)
  private userDataStore = new Map<string, UserResumeData>();

  constructor() {}

  /**
   * Get user data for template mapping
   */
  async getUserData(userId: string): Promise<{
    userId: string;
    data: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      linkedin?: string;
      github?: string;
    };
    lastUpdated?: Date;
  }> {
    const userData = this.userDataStore.get(userId) || {
      userId,
      lastUpdated: new Date(),
    };

    return {
      userId,
      data: {
        name: userData.name,
        address: userData.address,
        phone: userData.phone,
        email: userData.email,
        website: userData.website,
        linkedin: userData.linkedin,
        github: userData.github,
      },
      lastUpdated: userData.lastUpdated,
    };
  }

  /**
   * Update user data
   */
  async updateUserData(
    userId: string,
    data: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      linkedin?: string;
      github?: string;
    },
  ): Promise<{
    userId: string;
    data: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      linkedin?: string;
      github?: string;
    };
    lastUpdated: Date;
  }> {
    const existing = this.userDataStore.get(userId) || {
      userId,
      lastUpdated: new Date(),
    };

    const updated: UserResumeData = {
      ...existing,
      ...data,
      lastUpdated: new Date(),
    };

    this.userDataStore.set(userId, updated);

    return {
      userId,
      data: {
        name: updated.name,
        address: updated.address,
        phone: updated.phone,
        email: updated.email,
        website: updated.website,
        linkedin: updated.linkedin,
        github: updated.github,
      },
      lastUpdated: updated.lastUpdated,
    };
  }
}
