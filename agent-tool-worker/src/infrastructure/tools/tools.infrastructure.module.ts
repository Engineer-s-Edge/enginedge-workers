/**
 * Tools Infrastructure Module
 *
 * Registers all tool implementations with the application layer.
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationModule } from '@application/application.module';
import { ToolRegistry } from '@application/services/tool-registry.service';
import { FilesystemActor } from './actors/filesystem.actor';
import { TerminalActor } from './actors/terminal.actor';
import { HttpRequestActor } from './actors/http-request.actor';
import { InternalTodoActor } from './actors/internal-todo.actor';
import { LocalDBActor } from './actors/local-db.actor';
import { NotionActor } from './actors/notion.actor';
import { GoogleCalendarActor } from './actors/google-calendar.actor';
import { GoogleDriveActor } from './actors/google-drive.actor';
import { TodoistActor } from './actors/todoist.actor';
import { VirusTotalActor } from './actors/virustotal.actor';
import { MermaidActor } from './actors/mermaid.actor';
import { WolframRetriever } from './retrievers/wolfram.retriever';
import { FilesystemRetriever } from './retrievers/filesystem.retriever';
import { LocalDBRetriever } from './retrievers/localdb.retriever';
import { OCRRetriever } from './retrievers/ocr.retriever';
import { KnowledgeGraphRetriever } from './retrievers/knowledge-graph.retriever';

@Module({
  imports: [ApplicationModule],
  providers: [
    FilesystemActor,
    TerminalActor,
    HttpRequestActor,
    InternalTodoActor,
    LocalDBActor,
    NotionActor,
    GoogleCalendarActor,
    GoogleDriveActor,
    TodoistActor,
    VirusTotalActor,
    MermaidActor,
    WolframRetriever,
    FilesystemRetriever,
    LocalDBRetriever,
    OCRRetriever,
    KnowledgeGraphRetriever,
    // Provide ASSISTANT_WORKER_URL for KnowledgeGraphRetriever
    {
      provide: 'ASSISTANT_WORKER_URL',
      useFactory: (configService: ConfigService) => {
        return (
          configService.get<string>('ASSISTANT_WORKER_URL') ||
          process.env.ASSISTANT_WORKER_URL ||
          'http://localhost:3001'
        );
      },
      inject: [ConfigService],
    },
    // Register tool with ToolRegistry on module initialization
    {
      provide: 'TOOL_REGISTRATION',
      useFactory: (
        filesystemActor: FilesystemActor,
        terminalActor: TerminalActor,
        httpRequestActor: HttpRequestActor,
        internalTodoActor: InternalTodoActor,
        localDBActor: LocalDBActor,
        notionActor: NotionActor,
        googleCalendarActor: GoogleCalendarActor,
        googleDriveActor: GoogleDriveActor,
        todoistActor: TodoistActor,
        virusTotalActor: VirusTotalActor,
        mermaidActor: MermaidActor,
        wolframRetriever: WolframRetriever,
        filesystemRetriever: FilesystemRetriever,
        localDBRetriever: LocalDBRetriever,
        ocrRetriever: OCRRetriever,
        knowledgeGraphRetriever: KnowledgeGraphRetriever,
        toolRegistry: ToolRegistry,
      ) => {
        // Register tools with the registry
        toolRegistry.registerTool(filesystemActor);
        toolRegistry.registerTool(terminalActor);
        toolRegistry.registerTool(httpRequestActor);
        toolRegistry.registerTool(internalTodoActor);
        toolRegistry.registerTool(localDBActor);
        toolRegistry.registerTool(notionActor);
        toolRegistry.registerTool(googleCalendarActor);
        toolRegistry.registerTool(googleDriveActor);
        toolRegistry.registerTool(todoistActor);
        toolRegistry.registerTool(virusTotalActor);
        toolRegistry.registerTool(mermaidActor);
        toolRegistry.registerTool(wolframRetriever);
        toolRegistry.registerTool(filesystemRetriever);
        toolRegistry.registerTool(localDBRetriever);
        toolRegistry.registerTool(ocrRetriever);
        toolRegistry.registerTool(knowledgeGraphRetriever);
        return 'tools-registered';
      },
      inject: [
        FilesystemActor,
        TerminalActor,
        HttpRequestActor,
        InternalTodoActor,
        LocalDBActor,
        NotionActor,
        GoogleCalendarActor,
        GoogleDriveActor,
        TodoistActor,
        VirusTotalActor,
        MermaidActor,
        WolframRetriever,
        FilesystemRetriever,
        LocalDBRetriever,
        OCRRetriever,
        KnowledgeGraphRetriever,
        ToolRegistry,
      ],
    },
  ],
  exports: [
    FilesystemActor,
    TerminalActor,
    HttpRequestActor,
    InternalTodoActor,
    LocalDBActor,
    NotionActor,
    GoogleCalendarActor,
    GoogleDriveActor,
    TodoistActor,
    VirusTotalActor,
    MermaidActor,
    WolframRetriever,
    FilesystemRetriever,
    LocalDBRetriever,
    OCRRetriever,
    KnowledgeGraphRetriever,
  ],
})
export class ToolsInfrastructureModule {}
