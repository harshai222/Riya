import React, { useState, useEffect } from 'react';
import { SocialProfile } from './SocialProfile';
import { getUserProfile, DbUserProfile, User } from '../../lib/firebase';

interface ProfileTabLoaderProps {
  currentUser: User;
  onStartChat: (user: DbUserProfile) => void;
  onSelectUser: (user: DbUserProfile) => void;
}

export const ProfileTabLoader: React.FC<ProfileTabLoaderProps> = ({ currentUser, onStartChat, onSelectUser }) => {
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const p = await getUserProfile(currentUser.uid);
      setProfile(p);
      setLoading(false);
    };
    fetchProfile();
  }, [currentUser.uid]);

  if (loading || !profile) {
    return <div className="text-center py-20 text-cyan-500/40">Loading profile matrix...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <SocialProfile
        currentUser={currentUser}
        targetUser={profile}
        onMessage={onStartChat}
        onSelectUser={onSelectUser}
      />
    </div>
  );
};
