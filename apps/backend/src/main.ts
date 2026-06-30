import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);

  app.setGlobalPrefix('api', { exclude: ['health'] });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(morgan('combined'));

  app.enableCors({
    origin: config.get('CORS_ORIGINS', '*'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LeadHunter AI API')
    .setDescription('API para prospecção de leads empresariais com enriquecimento por IA')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Autenticação')
    .addTag('Users', 'Usuários')
    .addTag('Search', 'Pesquisas')
    .addTag('Companies', 'Empresas')
    .addTag('Leads', 'Leads')
    .addTag('Exports', 'Exportações')
    .addTag('Favorites', 'Favoritos')
    .addTag('Enrichment', 'Enriquecimento IA')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  logger.log(`🚀 LeadHunter AI API running on port ${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
