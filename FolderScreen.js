import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  StatusBar,
  TextInput,
  RefreshControl,
  ScrollView,
  Linking,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query,
  where 
} from "firebase/firestore";
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const auth = getAuth();
const db = getFirestore();

const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function FolderScreen({ navigation }) {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userAccount, setUserAccount] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (userAccount) {
      loadDocuments();
    }
  }, [userAccount]);

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      console.log("🔄 Loading user data...");
      
      if (user) {
        const memberRef = doc(db, "members", user.uid);
        const memberSnap = await getDoc(memberRef);
        
        if (memberSnap.exists()) {
          const memberData = memberSnap.data();
          const userAccNo = memberData.accNo || "";
          const userRole = memberData.role || "member";
          
          setUserRole(userRole);
          setUserAccount(userAccNo);
        } else {
          Alert.alert("Info", "No member profile found. Please contact administrator.");
        }
      } else {
        Alert.alert("Authentication Required", "Please log in to view documents.");
      }
    } catch (error) {
      console.log("❌ Error loading user data:", error.message);
      Alert.alert("Error", "Failed to load user data: " + error.message);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      if (!userAccount) {
        Alert.alert("Info", "No account number associated with your profile.");
        setDocuments([]);
        return;
      }

      const documentsQuery = query(
        collection(db, "member-documents"),
        where("accNo", "==", userAccount)
      );
      
      const querySnapshot = await getDocs(documentsQuery);
      
      if (querySnapshot.empty) {
        setDocuments([]);
        return;
      }

      const documentsData = [];
      querySnapshot.forEach((doc) => {
        const documentData = doc.data();
        documentsData.push({
          id: doc.id,
          name: documentData.name || "Unnamed Document",
          description: documentData.description || "No description available",
          accNo: documentData.accNo,
          memberName: documentData.memberName || "Unknown Member",
          size: documentData.size || 0,
          url: documentData.url || "",
          storagePath: documentData.storagePath || "",
          originalFileId: documentData.originalFileId || "",
          location: documentData.location || "member-docs",
          lastAccess: documentData.lastAccess || "Never",
          sentAt: documentData.sentAt || "Unknown date",
          fileType: getFileType(documentData.name),
          icon: getFileIcon(documentData.name),
          color: getFileColor(documentData.name),
        });
      });

      documentsData.sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
      setDocuments(documentsData);
      
    } catch (error) {
      console.log("❌ Error loading documents:", error.message);
      Alert.alert("Error", "Failed to load documents: " + error.message);
      setDocuments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // View document function
  const viewDocument = async (document) => {
    try {
      if (!document.url) {
        Alert.alert("Error", "No document URL available");
        return;
      }

      setDownloading(document.id);
      
      console.log("📄 Opening document:", document.name);
      console.log("🔗 Document URL:", document.url);
      
      // Try to open the URL directly first (for web URLs, PDFs, etc.)
      const canOpen = await Linking.canOpenURL(document.url);
      if (canOpen) {
        await Linking.openURL(document.url);
        console.log("✅ Document opened successfully in browser");
        return;
      }

      // If direct opening fails, show download options
      Alert.alert(
        "Open Document",
        `How would you like to open "${document.name}"?`,
        [
          {
            text: "Try in Browser",
            onPress: () => Linking.openURL(document.url)
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );

    } catch (error) {
      console.log("❌ Error viewing document:", error);
      Alert.alert("Error", "Failed to open document: " + error.message);
    } finally {
      setDownloading(null);
    }
  };

  // Helper function to determine file type
  const getFileType = (fileName) => {
    if (!fileName) return "file";
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (['pdf'].includes(extension)) return 'pdf';
    if (['doc', 'docx'].includes(extension)) return 'word';
    if (['xls', 'xlsx'].includes(extension)) return 'excel';
    if (['ppt', 'pptx'].includes(extension)) return 'powerpoint';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'jfif'].includes(extension)) return 'image';
    if (['txt'].includes(extension)) return 'text';
    
    return 'file';
  };

  // Helper function to get appropriate icon
  const getFileIcon = (fileName) => {
    const fileType = getFileType(fileName);
    
    switch (fileType) {
      case 'pdf': return 'document-text';
      case 'word': return 'document-text';
      case 'excel': return 'document-text';
      case 'powerpoint': return 'document-text';
      case 'image': return 'image';
      case 'text': return 'document-text';
      default: return 'document';
    }
  };

  // Helper function to get color based on file type
  const getFileColor = (fileName) => {
    const fileType = getFileType(fileName);
    
    switch (fileType) {
      case 'pdf': return '#E74C3C';
      case 'word': return '#2C78C3';
      case 'excel': return '#27AE60';
      case 'powerpoint': return '#E67E22';
      case 'image': return '#8E44AD';
      case 'text': return '#7F8C8D';
      default: return '#007b83';
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.memberName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDocumentPress = (document) => {
    Alert.alert(
      document.name,
      `What would you like to do with this document?`,
      [
        {
          text: "View Document",
          onPress: () => viewDocument(document)
        },
        {
          text: "File Details",
          onPress: () => showDocumentDetails(document)
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const showDocumentDetails = (document) => {
    Alert.alert(
      "File Details",
      `Name: ${document.name}\n\n` +
      `Description: ${document.description}\n` +
      `Member: ${document.memberName}\n` +
      `Size: ${formatFileSize(document.size)}\n` +
      `Type: ${document.fileType.toUpperCase()}\n` +
      `Last Accessed: ${document.lastAccess}\n` +
      `Uploaded: ${document.sentAt}\n\n` +
      `URL: ${document.url ? "Available" : "Not available"}`,
      [
        {
          text: "View Document",
          onPress: () => viewDocument(document)
        },
        {
          text: "OK",
          style: "default"
        }
      ]
    );
  };

  const renderDocumentItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.documentItem, { borderLeftColor: item.color }]}
      onPress={() => handleDocumentPress(item)}
      activeOpacity={0.7}
      disabled={downloading === item.id}
    >
      <View style={styles.documentHeader}>
        <View style={[styles.documentIcon, { backgroundColor: item.color }]}>
          {downloading === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={item.icon} size={24} color="#fff" />
          )}
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName}>{item.name}</Text>
          <Text style={styles.documentDescription}>{item.description}</Text>
          <Text style={styles.documentMeta}>
            {item.memberName} • {formatFileSize(item.size)} • {item.fileType.toUpperCase()}
          </Text>
        </View>
        <View style={styles.documentActions}>
          {downloading === item.id ? (
            <ActivityIndicator size="small" color="#00695C" />
          ) : (
            <Ionicons name="eye-outline" size={20} color="#00695C" />
          )}
        </View>
      </View>
      <View style={styles.documentFooter}>
        <Text style={styles.lastUpdated}>
          Uploaded: {item.sentAt}
        </Text>
        <Text style={styles.lastAccessed}>
          Last Access: {item.lastAccess}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#00695C" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Documents</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="document" size={64} color="#ccc" />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00695C" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Account Info */}
      {userAccount && (
        <View style={styles.accountInfo}>
          <Text style={styles.accountText}>Account: {userAccount}</Text>
          <Text style={styles.documentsCount}>{documents.length} documents</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery("")}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Document Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{documents.length}</Text>
          <Text style={styles.statLabel}>Total Files</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {formatFileSize(documents.reduce((total, doc) => total + (doc.size || 0), 0))}
          </Text>
          <Text style={styles.statLabel}>Total Size</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {new Set(documents.map(doc => doc.fileType)).size}
          </Text>
          <Text style={styles.statLabel}>File Types</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#00695C" />
            <Text style={styles.actionText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {
            if (documents.length > 0) {
              viewDocument(documents[0]);
            } else {
              Alert.alert("Info", "No documents available to view");
            }
          }}>
            <Ionicons name="eye" size={20} color="#00695C" />
            <Text style={styles.actionText}>View Latest</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <View style={styles.emptyContainer}>
          {documents.length === 0 ? (
            <>
              <Ionicons name="document-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No documents available</Text>
              <Text style={styles.emptyText}>
                No documents have been uploaded for your account yet.
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={onRefresh}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No documents found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your search terms
              </Text>
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery("")}
              >
                <Text style={styles.clearSearchText}>Clear Search</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          renderItem={renderDocumentItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#00695C"]}
              tintColor="#00695C"
            />
          }
          ListHeaderComponent={
            <View>
              <Text style={styles.listTitle}>
                {searchQuery ? "Search Results" : "Your Documents"} ({filteredDocuments.length})
              </Text>
              <Text style={styles.listSubtitle}>
                Tap on any document to view its content
              </Text>
            </View>
          }
        />
      )}

      {/* Footer - Same as CommitteeScreen */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle" size={22} color="#fff" />
          <Text style={styles.footerText}>Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Ionicons name="home" size={22} color="#fff" />
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#00695C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerRight: {
    width: 40,
  },
  accountInfo: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  accountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00695C",
  },
  documentsCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e5e9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
  },
  clearButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00695C",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  quickActions: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    minWidth: 100,
  },
  actionText: {
    marginTop: 4,
    fontSize: 12,
    color: "#00695C",
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  documentItem: {
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 12,
    color: "#999",
  },
  documentActions: {
    padding: 4,
  },
  documentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  lastUpdated: {
    fontSize: 11,
    color: "#999",
  },
  lastAccessed: {
    fontSize: 11,
    color: "#999",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: "#00695C",
    borderRadius: 8,
  },
  clearSearchText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00695C",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  refreshButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  // Footer styles from CommitteeScreen
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#004d40",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerButton: {
    alignItems: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
});