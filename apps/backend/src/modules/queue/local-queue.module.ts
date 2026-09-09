import { Global, Injectable, Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

type Handler = (job: { data: any }) => Promise<unknown>;

@Injectable()
export class LocalQueue {
  private handler?: Handler;

  register(handler: Handler) {
    this.handler = handler;
  }

  async add(_name: string, data: any) {
    if (!this.handler) throw new Error('Fila local ainda não inicializada');
    const handler = this.handler;
    setImmediate(() => handler({ data }).catch((error) => console.error('[LocalQueue]', error)));
    return { id: `${Date.now()}` };
  }
}

@Global()
@Module({
  providers: [
    { provide: getQueueToken('search'), useFactory: () => new LocalQueue() },
    { provide: getQueueToken('enrichment'), useFactory: () => new LocalQueue() },
    { provide: getQueueToken('exports'), useFactory: () => new LocalQueue() },
  ],
  exports: [getQueueToken('search'), getQueueToken('enrichment'), getQueueToken('exports')],
})
export class LocalQueueModule {}
