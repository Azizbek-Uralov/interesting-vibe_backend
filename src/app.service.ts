import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './db';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export class App {
  static async main() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: env.FRONTEND_URL, credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Visual Discovery API')
      .setDescription('Visual platform backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('accessToken', {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
      })
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, openApiDocument, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'openapi.json',
    });
    await app.listen(env.PORT, () =>
      console.log('Server listening on PORT', env.PORT),
    );
  }
}
