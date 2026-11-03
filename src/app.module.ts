import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './db/prisma/prisma.module';
import { RedisModule } from './db/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { OtpModule } from './modules/otp/otp.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { FollowsModule } from './modules/follows/follows.module';
import { LikesModule } from './modules/likes/likes.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FeedModule } from './modules/feed/feed.module';
import { SearchModule } from './modules/search/search.module';
import { TagsModule } from './modules/tags/tags.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    OtpModule,
    UsersModule,
    PostsModule,
    CategoriesModule,
    SessionsModule,
    UploadsModule,
    FollowsModule,
    LikesModule,
    CollectionsModule,
    NotificationsModule,
    FeedModule,
    SearchModule,
    TagsModule,
    AdminModule,
    ChatModule,
  ],
})
export class AppModule {}
