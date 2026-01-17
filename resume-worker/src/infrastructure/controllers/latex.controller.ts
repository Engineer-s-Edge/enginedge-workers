import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LatexService } from '../../application/services/latex.service';

@Controller('resume/ai')
export class LatexController {
  constructor(private readonly latexService: LatexService) {}

  @Post('edit-latex')
  @HttpCode(HttpStatus.OK)
  async editLatex(
    @Body()
    body: {
      resumeId: string;
      latexContent: string;
      userRequest: string;
      lintingErrors?: any[];
      lintingWarnings?: any[];
    },
  ) {
    return this.latexService.editLatex(
      body.resumeId,
      body.latexContent,
      body.userRequest,
      body.lintingErrors,
      body.lintingWarnings,
    );
  }

  @Post('analyze-latex')
  @HttpCode(HttpStatus.OK)
  async analyzeLatex(
    @Body()
    body: {
      latexContent: string;
      lintingErrors?: any[];
      lintingWarnings?: any[];
      analysisType?: string;
    },
  ) {
    return this.latexService.analyzeLatex(
      body.latexContent,
      body.lintingErrors,
      body.lintingWarnings,
      body.analysisType,
    );
  }
}

@Controller('latex')
export class LatexLintController {
  constructor(private readonly latexService: LatexService) {}

  @Post('lint')
  @HttpCode(HttpStatus.OK)
  async lint(
    @Body()
    body: {
      latexContent: string;
      options?: {
        checkSyntax?: boolean;
        checkStyle?: boolean;
        checkBestPractices?: boolean;
      };
    },
  ) {
    return this.latexService.lint(body.latexContent, body.options);
  }
}
