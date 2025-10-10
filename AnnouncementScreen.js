// AnnouncementScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  deleteDoc,
  getDocs,
  where,
  getCountFromServer,
  limit,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AnnouncementScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentTexts, setCommentTexts] = useState({});
  const [comments, setComments] = useState({});
  const [reacts, setReacts] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  const [imageDimensions, setImageDimensions] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [userProfiles, setUserProfiles] = useState({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [commentMenuVisible, setCommentMenuVisible] = useState(null); // Track which comment menu is open

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const storage = getStorage();

  const adminUIDs = ["ADMIN_UID_1", "ADMIN_UID_2"];

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Update User Name in All Comments
  const updateUserNameInAllComments = async (userId, newName, newPhotoURL = null) => {
    if (!userId || !newName) return;
    
    try {
      const postsQuery = query(collection(db, "posts"));
      const postsSnapshot = await getDocs(postsQuery);
      
      const batch = writeBatch(db);
      let updatedCommentsCount = 0;

      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        
        const commentsQuery = query(
          collection(db, "posts", postId, "comments"),
          where("userId", "==", userId)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        
        commentsSnapshot.forEach((commentDoc) => {
          const commentRef = doc(db, "posts", postId, "comments", commentDoc.id);
          const updateData = {
            authorName: newName,
            userName: newName,
            user: newName
          };
          
          if (newPhotoURL) {
            updateData.photoURL = newPhotoURL;
          }
          
          batch.update(commentRef, updateData);
          updatedCommentsCount++;
        });
      }

      if (updatedCommentsCount > 0) {
        await batch.commit();
        await updateUserNameInAllReacts(userId, newName, newPhotoURL);
      }
    } catch (error) {
      console.error("Error updating username in comments:", error);
    }
  };

  // Update User Name in All Reacts
  const updateUserNameInAllReacts = async (userId, newName, newPhotoURL = null) => {
    if (!userId || !newName) return;
    
    try {
      const postsQuery = query(collection(db, "posts"));
      const postsSnapshot = await getDocs(postsQuery);
      
      const batch = writeBatch(db);
      let updatedReactsCount = 0;

      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        
        const reactsQuery = query(
          collection(db, "posts", postId, "reacts"),
          where("userId", "==", userId)
        );
        const reactsSnapshot = await getDocs(reactsQuery);
        
        reactsSnapshot.forEach((reactDoc) => {
          const reactRef = doc(db, "posts", postId, "reacts", reactDoc.id);
          const updateData = {
            authorName: newName
          };
          
          if (newPhotoURL) {
            updateData.photoURL = newPhotoURL;
          }
          
          batch.update(reactRef, updateData);
          updatedReactsCount++;
        });
      }

      if (updatedReactsCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error updating username in reacts:", error);
    }
  };

  // Get user profile data
  const getUserProfileData = async (userId) => {
    if (!userId) return { name: "User", photoURL: null };
    
    try {
      if (userProfiles[userId]) {
        return userProfiles[userId];
      }
      
      if (userId === currentUser?.uid) {
        const userRef = doc(db, "members", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const profileData = {
            name: userData.name || userData.displayName || "User",
            photoURL: userData.photoURL || null
          };
          
          setUserProfiles(prev => ({
            ...prev,
            [userId]: profileData
          }));
          
          return profileData;
        }
      }
      
      return { name: "User", photoURL: null };
      
    } catch (error) {
      if (error.code === 'permission-denied' || error.code === 'missing-or-insufficient-permissions') {
        return { name: "User", photoURL: null };
      }
      console.error("Error fetching user profile:", error);
      return { name: "User", photoURL: null };
    }
  };

  // Listen for user profile changes
  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, "members", currentUser.uid);
    
    const unsubscribe = onSnapshot(userRef, async (userSnap) => {
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const newName = userData.name || userData.displayName;
        const newPhotoURL = userData.photoURL || null;
        const oldName = userProfiles[currentUser.uid]?.name;
        const oldPhotoURL = userProfiles[currentUser.uid]?.photoURL;

        if (newName && oldName && (newName !== oldName || newPhotoURL !== oldPhotoURL)) {
          await updateUserNameInAllComments(currentUser.uid, newName, newPhotoURL);
        }

        setUserProfiles(prev => ({
          ...prev,
          [currentUser.uid]: {
            name: newName || "User",
            photoURL: newPhotoURL
          }
        }));
      }
    }, (error) => {
      if (error.code === 'permission-denied') {
        // Handle permission error silently
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Notification Logic
  const getLastSeenAnnouncement = async (uid) => {
    if (!uid) return null;
    return await AsyncStorage.getItem(`lastSeenAnnouncement_${uid}`);
  };

  const setLastSeenAnnouncement = async (uid, timestamp) => {
    if (!uid) return;
    await AsyncStorage.setItem(`lastSeenAnnouncement_${uid}`, String(timestamp));
  };

  useEffect(() => {
    if (!currentUser?.uid) return;

    const latestPostQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(latestPostQuery, async (snapshot) => {
      if (!snapshot.empty) {
        const latestPost = snapshot.docs[0].data();
        const latestTimestamp = latestPost.createdAt?.seconds || 0;

        const lastSeenRaw = await getLastSeenAnnouncement(currentUser.uid);
        const lastSeen = Number(lastSeenRaw) || 0;

        if (!lastSeenRaw) {
          await setLastSeenAnnouncement(currentUser.uid, latestTimestamp);
          navigation.setParams({ hasNewAnnouncement: false });
        } else {
          navigation.setParams({
            hasNewAnnouncement: latestTimestamp > lastSeen,
          });
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (posts.length > 0 && currentUser?.uid) {
        const latest = posts[0].createdAt?.seconds;
        if (latest) {
          setLastSeenAnnouncement(currentUser.uid, latest);
          navigation.setParams({ hasNewAnnouncement: false });
        }
      }
    }, [posts, currentUser])
  );

  const fetchUserProfile = async (userId) => {
    if (!userId || userProfiles[userId]) return;
    
    try {
      if (userId === currentUser?.uid) {
        const userRef = doc(db, "members", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfiles(prev => ({
            ...prev,
            [userId]: {
              name: userData.name || userData.displayName || "User",
              photoURL: userData.photoURL || null
            }
          }));
        }
      }
    } catch (error) {
      // Handle permission errors silently
    }
  };

  const getCommentCount = async (postId) => {
    try {
      const commentsRef = collection(db, "posts", postId, "comments");
      const snapshot = await getCountFromServer(commentsRef);
      return snapshot.data().count;
    } catch (error) {
      console.error("Error getting comment count:", error);
      return 0;
    }
  };

  const hasUserReacted = (postId) => {
    return (
      reacts[postId]?.some((react) => react.userId === currentUser?.uid) || false
    );
  };

  const toggleLike = async (postId) => {
    if (!currentUser?.uid) return;

    try {
      const reactsRef = collection(db, "posts", postId, "reacts");
      const userReactQuery = query(
        reactsRef,
        where("userId", "==", currentUser.uid)
      );

      const snapshot = await getDocs(userReactQuery);

      const postRef = doc(db, "posts", postId);
      const currentPost = posts.find((p) => p.id === postId);

      const userProfile = await getUserProfileData(currentUser.uid);
      const userPhotoURL = userProfile.photoURL || currentUser.photoURL || null;
      const userName = userProfile.name || currentUser.displayName || "User";

      if (snapshot.empty) {
        await addDoc(reactsRef, {
          userId: currentUser.uid,
          authorName: userName,
          photoURL: userPhotoURL,
          createdAt: serverTimestamp(),
          type: "like",
        });
        await updateDoc(postRef, {
          reactsCount: (currentPost?.reactsCount || 0) + 1,
        });
      } else {
        const reactDoc = snapshot.docs[0];
        await deleteDoc(doc(db, "posts", postId, "reacts", reactDoc.id));
        await updateDoc(postRef, {
          reactsCount: Math.max(0, (currentPost?.reactsCount || 0) - 1),
        });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const addComment = async (postId, currentCommentsCount) => {
    const text = commentTexts[postId];
    if (!text?.trim() || !currentUser?.uid) return;

    try {
      const commentsRef = collection(db, "posts", postId, "comments");

      const userProfile = await getUserProfileData(currentUser.uid);
      const userPhotoURL = userProfile.photoURL || currentUser.photoURL || null;
      const userName = userProfile.name || currentUser.displayName || "Anonymous";

      await addDoc(commentsRef, {
        text: text.trim(),
        authorName: userName,
        userId: currentUser.uid,
        userName: userName,
        photoURL: userPhotoURL,
        isAdmin: adminUIDs.includes(currentUser.uid),
        createdAt: serverTimestamp(),
      });

      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentsCount: (currentCommentsCount || 0) + 1,
      });

      setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const deleteComment = async (postId, commentId, currentCommentsCount) => {
    try {
      await deleteDoc(doc(db, "posts", postId, "comments", commentId));
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentsCount: Math.max(0, (currentCommentsCount || 1) - 1),
      });
      setCommentMenuVisible(null); // Close menu after deletion
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const startEditComment = (comment) => {
    setEditingComment(comment);
    setEditText(comment.text);
    setCommentMenuVisible(null); // Close menu when editing starts
  };

  const saveEditedComment = async (postId, commentId) => {
    if (!editText.trim()) return;

    try {
      const commentRef = doc(db, "posts", postId, "comments", commentId);
      await updateDoc(commentRef, { text: editText.trim() });
      setEditingComment(null);
      setEditText("");
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const cancelEditComment = () => {
    setEditingComment(null);
    setEditText("");
  };

  const toggleCommentMenu = (commentId) => {
    setCommentMenuVisible(commentMenuVisible === commentId ? null : commentId);
  };

  const handleImageError = (postId, error) => {
    setImageErrors((prev) => ({ ...prev, [postId]: true }));
    setImageLoadingStates((prev) => ({ ...prev, [postId]: false }));
  };

  const handleImageLoad = (postId, event) => {
    const { width, height } = event.nativeEvent.source;
    setImageDimensions((prev) => ({ ...prev, [postId]: { width, height } }));
    setImageLoadingStates((prev) => ({ ...prev, [postId]: false }));
  };

  const handleImageLoadStart = (postId) => {
    setImageLoadingStates((prev) => ({ ...prev, [postId]: true }));
  };

  const calculateImageHeight = (postId, containerWidth = screenWidth - 50) => {
    const dimensions = imageDimensions[postId];
    if (!dimensions) return 200;
    const aspectRatio = dimensions.width / dimensions.height;
    const calculatedHeight = containerWidth / aspectRatio;
    return Math.min(Math.max(calculatedHeight, 150), 400);
  };

  const renderUserAvatar = (userId, photoURL = null, size = 32) => {
    const userProfile = userProfiles[userId];
    const avatarPhotoURL = photoURL || userProfile?.photoURL;
    
    if (avatarPhotoURL) {
      return (
        <Image
          source={{ uri: avatarPhotoURL }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      );
    }
    
    const displayName = userProfile?.name || "U";
    return (
      <View style={[styles.commentAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.commentAvatarText}>
          {displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  // Render Post Content (reusable for both main feed and modal)
  const renderPostContent = (item, isInModal = false) => (
    <View style={[styles.postContainer, isInModal && styles.modalPostContainer]}>
      <View style={styles.postHeader}>
        {renderUserAvatar(item.author?.uid || "default", null, 40)}
        <View style={styles.postHeaderInfo}>
          <Text style={styles.authorName}>
            {item.author?.name || "HOA Member"}
          </Text>
          <Text style={styles.postTime}>
            {item.createdAt
              ? new Date(item.createdAt.seconds * 1000).toLocaleString()
              : "Date not available"}
          </Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {item.category?.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.postContent}>
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postDescription}>{item.description}</Text>

        {item.imageUrl &&
        !imageErrors[item.id] &&
        item.imageUrl.trim() !== "" &&
        !item.imageUrl.includes("via.placeholder.com") ? (
          <View style={styles.imageContainer}>
            {imageLoadingStates[item.id] && !imageDimensions[item.id] ? (
              <View
                style={[
                  styles.imageLoader,
                  { height: calculateImageHeight(item.id, isInModal ? screenWidth - 32 : screenWidth - 50) },
                ]}
              >
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading image...</Text>
              </View>
            ) : null}
            <Image
              source={{
                uri: item.imageUrl,
                cache: "force-cache",
              }}
              style={[
                styles.postImage,
                {
                  height: calculateImageHeight(item.id, isInModal ? screenWidth - 32 : screenWidth - 50),
                  minHeight: 150,
                },
              ]}
              resizeMode="contain"
              onLoadStart={() => handleImageLoadStart(item.id)}
              onLoad={(event) => handleImageLoad(item.id, event)}
              onError={(error) => handleImageError(item.id, error)}
            />
          </View>
        ) : null}

        {imageErrors[item.id] && (
          <View style={styles.imageError}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
            <Text style={styles.imageErrorText}>Image failed to load</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setImageErrors((prev) => ({ ...prev, [item.id]: false }));
                setImageLoadingStates((prev) => ({ ...prev, [item.id]: true }));
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.postStats}>
        <Text style={styles.statText}>{item.reactsCount || 0} likes</Text>
        <Text style={styles.statText}>
          {commentCounts[item.id] || 0} comments
        </Text>
      </View>

      {!isInModal && (
        <View style={styles.postActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              hasUserReacted(item.id) && styles.activeActionButton,
            ]}
            onPress={() => toggleLike(item.id)}
          >
            <Ionicons
              name={hasUserReacted(item.id) ? "heart" : "heart-outline"}
              size={20}
              color={hasUserReacted(item.id) ? "#e74c3c" : "#555"}
            />
            <Text
              style={[
                styles.actionText,
                hasUserReacted(item.id) && styles.activeActionText,
              ]}
            >
              Like
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setSelectedPost(item)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#555" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  useEffect(() => {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      async (snapshot) => {
        const postsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const imageUrl = data.mediaUrl || data.imageUrl || "";
          return {
            id: docSnap.id,
            ...data,
            title: data.content || "No title",
            description: data.content || "No description",
            author: { name: data.authorName || "HOA Member" },
            createdAt: data.createdAt,
            imageUrl: imageUrl,
            category: data.category || "announcement",
            reactsCount: data.reactsCount || 0,
            commentsCount: data.commentsCount || 0,
          };
        });

        setPosts(postsData);
        setLoading(false);

        const counts = {};
        for (const post of postsData) {
          counts[post.id] = await getCommentCount(post.id);
        }
        setCommentCounts(counts);

        postsData.forEach((post) => {
          const commentsQuery = query(
            collection(db, "posts", post.id, "comments"),
            orderBy("createdAt", "asc")
          );

          onSnapshot(commentsQuery, (commentsSnapshot) => {
            const postComments = commentsSnapshot.docs.map((commentDoc) => {
              const commentData = commentDoc.data();
              
              if (commentData.userId === currentUser?.uid) {
                fetchUserProfile(commentData.userId);
              }
              
              return {
                id: commentDoc.id,
                text: commentData.text || commentData.content || "",
                user:
                  commentData.authorName ||
                  commentData.user ||
                  commentData.userName ||
                  "Anonymous",
                isAdmin: commentData.isAdmin || false,
                createdAt: commentData.createdAt,
                userId: commentData.userId,
                photoURL: commentData.photoURL || null,
                ...commentData,
              };
            });
            setComments((prev) => ({ ...prev, [post.id]: postComments }));
            setCommentCounts((prev) => ({
              ...prev,
              [post.id]: commentsSnapshot.size,
            }));
          });

          const reactsQuery = query(collection(db, "posts", post.id, "reacts"));
          onSnapshot(reactsQuery, (reactsSnapshot) => {
            const postReacts = reactsSnapshot.docs.map((reactDoc) => {
              const reactData = reactDoc.data();
              
              if (reactData.userId === currentUser?.uid) {
                fetchUserProfile(reactData.userId);
              }
              
              return {
                id: reactDoc.id,
                ...reactData,
                photoURL: reactData.photoURL || null,
              };
            });
            setReacts((prev) => ({ ...prev, [post.id]: postReacts }));
          });
        });
      },
      (error) => {
        console.error("Error fetching posts:", error);
        setLoading(false);
      }
    );

    return () => unsubscribePosts();
  }, []);

  const renderItem = ({ item }) => renderPostContent(item, false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No announcements yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Modern Comment Modal with Post */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        onRequestClose={() => {
          setSelectedPost(null);
          setCommentMenuVisible(null); // Close any open menus when modal closes
          cancelEditComment(); // Cancel any active editing
        }}
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Text style={styles.modalTitle}>Post & Comments</Text>
              <Text style={styles.commentCount}>
                {commentCounts[selectedPost?.id] || 0} comments
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedPost(null);
                setCommentMenuVisible(null);
                cancelEditComment();
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content - Post + Comments */}
          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.modalContentContainer,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight + (editingComment ? 200 : 120) : 120 }
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Post Content */}
            {selectedPost && renderPostContent(selectedPost, true)}

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>Comments</Text>
              
              {selectedPost && comments[selectedPost.id]?.length > 0 ? (
                comments[selectedPost.id].map((comment) => (
                  <View
                    key={comment.id}
                    style={[
                      styles.commentItem,
                      comment.isAdmin && styles.adminCommentItem,
                    ]}
                  >
                    {renderUserAvatar(comment.userId, comment.photoURL, 36)}
                    
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAuthorContainer}>
                          <Text
                            style={[
                              styles.commentAuthor,
                              comment.isAdmin && styles.adminAuthor,
                            ]}
                          >
                            {comment.user}
                          </Text>
                          {comment.isAdmin && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>Admin</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.commentHeaderRight}>
                          <Text style={styles.commentTime}>
                            {comment.createdAt
                              ? new Date(
                                  comment.createdAt.seconds * 1000
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </Text>
                          
                          {/* Three dots menu for comment actions */}
                          {(comment.userId === currentUser?.uid ||
                            adminUIDs.includes(currentUser?.uid)) &&
                            !editingComment && (
                            <View style={styles.commentMenuContainer}>
                              <TouchableOpacity
                                style={styles.commentMenuButton}
                                onPress={() => toggleCommentMenu(comment.id)}
                              >
                                <Ionicons name="ellipsis-horizontal" size={16} color="#666" />
                              </TouchableOpacity>
                              
                              {/* Comment Actions Menu */}
                              {commentMenuVisible === comment.id && (
                                <View style={styles.commentMenu}>
                                  <TouchableOpacity
                                    style={styles.commentMenuItem}
                                    onPress={() => startEditComment(comment)}
                                  >
                                    <Ionicons name="create-outline" size={16} color="#666" />
                                    <Text style={styles.commentMenuItemText}>Edit</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.commentMenuItem, styles.deleteMenuItem]}
                                    onPress={() =>
                                      deleteComment(
                                        selectedPost.id,
                                        comment.id,
                                        selectedPost.commentsCount
                                      )
                                    }
                                  >
                                    <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                                    <Text style={[styles.commentMenuItemText, styles.deleteMenuItemText]}>
                                      Delete
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>

                      {editingComment?.id === comment.id ? (
                        // Empty view since edit interface is now above keyboard
                        <Text style={styles.commentText}>{comment.text}</Text>
                      ) : (
                        <Text style={styles.commentText}>{comment.text}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noComments}>
                  <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                  <Text style={styles.noCommentsText}>No comments yet</Text>
                  <Text style={styles.noCommentsSubtext}>
                    Be the first to comment on this post
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Edit Comment Interface - Positioned above keyboard */}
          {editingComment && (
            <View style={[
              styles.editCommentContainer,
              { bottom: keyboardHeight }
            ]}>
              <View style={styles.editCommentHeader}>
                <Text style={styles.editCommentTitle}>Edit Comment</Text>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={cancelEditComment}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.editCommentInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
                placeholder="Edit your comment..."
                placeholderTextColor="#999"
              />
              <View style={styles.editCommentActions}>
                <TouchableOpacity
                  style={styles.cancelEditActionButton}
                  onPress={cancelEditComment}
                >
                  <Text style={styles.cancelEditActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveEditActionButton,
                    !editText.trim() && styles.saveEditActionButtonDisabled,
                  ]}
                  onPress={() => saveEditedComment(selectedPost.id, editingComment.id)}
                  disabled={!editText.trim()}
                >
                  <Text style={styles.saveEditActionText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Comment Input - Positioned above keyboard (only show when not editing) */}
          {currentUser && !editingComment && (
            <View style={[
              styles.commentInputContainer,
              { bottom: keyboardHeight }
            ]}>
              {renderUserAvatar(currentUser.uid, null, 36)}
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#999"
                value={commentTexts[selectedPost?.id] || ""}
                onChangeText={(text) =>
                  setCommentTexts((prev) => ({
                    ...prev,
                    [selectedPost.id]: text,
                  }))
                }
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !commentTexts[selectedPost?.id]?.trim() &&
                    styles.sendButtonDisabled,
                ]}
                onPress={() =>
                  addComment(selectedPost.id, selectedPost.commentsCount)
                }
                disabled={!commentTexts[selectedPost?.id]?.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={
                    commentTexts[selectedPost?.id]?.trim() ? "white" : "#ccc"
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#555",
  },
  postContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  modalPostContainer: {
    margin: 0,
    marginBottom: 20,
    padding: 16,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    elevation: 0,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorName: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
    marginBottom: 2,
  },
  postTime: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: "#e1f5fe",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
  },
  postContent: {
    marginBottom: 10,
  },
  postTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  postDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  imageContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f8f8f8",
  },
  postImage: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  imageLoader: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  imageError: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginTop: 10,
  },
  imageErrorText: {
    marginTop: 8,
    color: "#888",
    fontSize: 14,
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  postStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginVertical: 8,
  },
  statText: {
    fontSize: 13,
    color: "#666",
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 5,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  activeActionButton: {
    backgroundColor: "#ffebee",
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#555",
    fontWeight: "600",
  },
  activeActionText: {
    color: "#e74c3c",
  },
  commentAvatar: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },

  // Modern Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  commentCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: 120,
  },
  commentsSection: {
    paddingHorizontal: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    marginTop: 8,
  },
  noComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noCommentsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  adminCommentItem: {
    backgroundColor: '#fff8e1',
    borderLeftWidth: 3,
    borderLeftColor: '#e67e22',
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  commentAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  adminAuthor: {
    color: '#e67e22',
  },
  adminBadge: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  commentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentTime: {
    fontSize: 11,
    color: '#999',
    marginRight: 8,
  },
  commentMenuContainer: {
    position: 'relative',
  },
  commentMenuButton: {
    padding: 4,
  },
  commentMenu: {
    position: 'absolute',
    top: 24,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 120,
    zIndex: 1000,
  },
  commentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  deleteMenuItem: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentMenuItemText: {
    fontSize: 14,
    color: '#333',
  },
  deleteMenuItemText: {
    color: '#e74c3c',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },

  // Edit Comment Interface Styles
  editCommentContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  editCommentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editCommentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editCommentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f8f9fa',
  },
  editCommentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  cancelEditActionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelEditActionText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  saveEditActionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  saveEditActionButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  saveEditActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Comment Input Styles
  commentInputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
});