import { verifyEventCover } from "@/lib/event-cover";
import { profileImagesService } from "./profile-images";

export const eventCoverImagesService = {
  async upload(userId: string, file: File): Promise<string> {
    await verifyEventCover(file);
    // Reuse private, user-owned image storage. This uploads an asset only;
    // it does not update the user's profile or grant event-management access.
    return profileImagesService.upload("banners", userId, file);
  },
};
