import UsersPanel from './UsersPanel';
import PostsPanel from './PostsPanel';
import LivesPanel from './LivesPanel';
import KeysPanel from './KeysPanel';
import NotifsPanel from './NotifsPanel';
import LogsPanel from './LogsPanel';
import SuperAdminPanel from './SuperAdminPanel';
import CargosTab from './CargosTab';
import ModerationPanel from '../moderation/ModerationPanel';

/** Despacha a aba ativa do painel admin para o painel correspondente. */
export default function AdminTabContent({ tab, isSuperAdmin, data, filters, actions, modals }) {
  switch (tab) {
    case 'users':
      return (
        <UsersPanel
          users={data.users} currentUserId={data.currentUserId} isSuperAdmin={isSuperAdmin}
          userSearch={filters.userSearch} setUserSearch={filters.setUserSearch}
          filterRole={filters.filterRole} setFilterRole={filters.setFilterRole}
          onNominate={actions.handleNominate} onDemote={actions.handleDemote}
          setBanModal={modals.setBanModal} setUnbanDirectModal={modals.setUnbanDirectModal}
          setUnbanReqModal={modals.setUnbanReqModal} handleDeletePosts={actions.handleDeletePosts}
          pendingUnbanIds={data.pendingUnbanIds}
        />
      );

    case 'posts':
      return (
        <PostsPanel
          posts={data.posts} handleDeletePost={actions.handleDeletePost}
          handleRestorePost={actions.handleRestorePost}
          handlePermanentDeletePost={actions.handlePermanentDeletePost}
          handlePermanentDeleteAllDeleted={actions.handlePermanentDeleteAllDeleted}
          hasMore={data.postsHasMore} loadingMore={data.loadingMorePosts}
          onLoadMore={data.loadMorePosts}
        />
      );

    case 'moderation':
      return <ModerationPanel />;

    case 'lives':
      return (
        <LivesPanel
          liveMod={data.liveMod} refreshing={data.refreshing} fetchLiveMod={data.fetchLiveMod}
          unsilenceUser={actions.unsilenceUser} handleEndLive={actions.handleEndLive}
          setReactivateModal={modals.setReactivateModal} isSuperAdmin={isSuperAdmin}
        />
      );

    case 'keys':
      return (
        <KeysPanel
          keys={data.keys} fetchAll={data.fetchAll} handleDeleteKey={actions.handleDeleteKey}
          hasMore={data.keysHasMore} loadingMore={data.loadingMoreKeys}
          onLoadMore={data.loadMoreKeys}
        />
      );

    case 'notifs':
      return (
        <NotifsPanel
          notifications={data.notifications} readIds={data.readIds}
          notifLoading={data.notifLoading} fetchNotifications={data.fetchNotifications}
        />
      );

    case 'logs':
      return (
        <LogsPanel
          logs={data.logs} logCat={data.logCat} setLogCat={data.setLogCat}
          logsLoading={data.logsLoading} fetchLogs={data.fetchLogs}
        />
      );

    case 'cargos':
      return isSuperAdmin ? <CargosTab /> : null;

    case 'super':
      return isSuperAdmin ? (
        <SuperAdminPanel
          blockedLogins={data.blockedLogins} blockedLoading={data.blockedLoading}
          fetchBlockedLogins={data.fetchBlockedLogins} setUnlockModal={modals.setUnlockModal}
          unbanRequests={data.unbanRequests} unbanReqLoading={data.unbanReqLoading}
          fetchUnbanRequests={data.fetchUnbanRequests} setDenyUnbanModal={modals.setDenyUnbanModal}
          handleApproveUnban={actions.handleApproveUnban} pendingUnbanCount={data.pendingUnbanCount}
          liveMod={data.liveMod} refreshing={data.refreshing} fetchLiveMod={data.fetchLiveMod}
          handleApproveRequest={actions.handleApproveRequest}
          handleDenyRequest={actions.handleDenyRequest}
        />
      ) : null;

    default:
      return null;
  }
}
