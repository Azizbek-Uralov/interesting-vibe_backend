import { Roles, UserStatus } from '../../../generated/prisma/enums';

export interface IPayload {
  id: string;
  sid: string;
  role: Roles;
  status: UserStatus;
}
