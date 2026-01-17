import { Injectable } from '@nestjs/common';

export interface LatexTemplate {
  name: string;
  content: string;
}

@Injectable()
export class LatexTemplateFactory {
  create(name: string, content: string): LatexTemplate {
    return { name, content };
  }
}
