import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Render / Fly / generic PaaS provide PORT. Fall back to API_PORT, then 4000.
  const port = parseInt(
    process.env.PORT ?? process.env.API_PORT ?? '4000',
    10,
  );
  // Bind to 0.0.0.0 so the container is reachable from outside (required by Render).
  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(`[Burmalda API] listening on 0.0.0.0:${port}`);
}

bootstrap();
