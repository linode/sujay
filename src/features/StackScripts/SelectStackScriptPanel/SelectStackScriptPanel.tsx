import * as React from 'react';

import * as classNames from 'classnames';

import { StyleRulesCallback, Theme, withStyles, WithStyles } from '@material-ui/core/styles';

import { connect } from 'react-redux';

import { compose, pathOr } from 'ramda';

import { getCommunityStackscripts, getStackScriptsByUser } from 'src/services/stackscripts';

import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUp from '@material-ui/icons/KeyboardArrowUp';

import Button from 'src/components/Button';
import CircleProgress from 'src/components/CircleProgress';
import RenderGuard from 'src/components/RenderGuard';
import TabbedPanel from 'src/components/TabbedPanel';
import TableCell from 'src/components/TableCell';

import StackScriptsSection from './StackScriptsSection';

import Table from 'src/components/Table';

export interface ExtendedLinode extends Linode.Linode {
  heading: string;
  subHeadings: string[];
}

type SortOrder = 'asc' | 'desc';

type ClassNames = 'root'
  | 'creating'
  | 'selecting'
  | 'stackscriptLabel'
  | 'stackscriptTitles'
  | 'deploys'
  | 'revisions'
  | 'tr'
  | 'tableHead'
  | 'sortButton'
  | 'table';

const styles: StyleRulesCallback<ClassNames> = (theme: Theme & Linode.Theme) => ({
  root: {
    marginBottom: theme.spacing.unit * 3,
  },
  creating: {
    height: 400,
    overflowX: 'auto',
    paddingTop: 0,
    marginTop: theme.spacing.unit * 2,
    overflowY: 'scroll',
    '-webkit-appearance': 'none',
  },
  selecting: {
    minHeight: '400px',
    maxHeight: '1000px',
    overflowX: 'auto',
  },
  table: {
    overflow: 'scroll',
  },
  stackscriptLabel: {
    width: 84,
  },
  stackscriptTitles: {
    width: '30%',
  },
  deploys: {
    width: '20%',
  },
  revisions: {
    width: '20%',
  },
  tr: {
    height: 48,
  },
  tableHead: {
    position: 'sticky',
    top: 0,
    backgroundColor: theme.bg.offWhite,
    zIndex: 10,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sortButton: {
    marginLeft: -26,
    border: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
});

interface Props {
  selectedId?: number | null;
  error?: string;
  shrinkPanel?: boolean;
  onSelect?: (id: number, label: string, username: string, images: string[],
    userDefinedFields: Linode.StackScript.UserDefinedField[]) => void;
  publicImages: Linode.Image[];
  noHeader?: boolean;
}

type StyledProps = Props & WithStyles<ClassNames>;

type CombinedProps = StyledProps;

const SelectStackScriptPanel: React.StatelessComponent<CombinedProps> = (props) => {
  const { classes, publicImages, noHeader, error,
  shrinkPanel, onSelect } = props;
  
  const tabs = [
    {
      title: 'My StackScripts',
      render: () => <StyledContainer
        onSelect={onSelect}
        // images is an optional prop, so just send an empty array if we didn't get any
        publicImages={publicImages}
        request={getStackScriptsByUser} key={0}
      />,
    },
    {
      title: 'Linode StackScripts',
      render: () => <StyledContainer
        onSelect={onSelect}
        // images is an optional prop, so just send an empty array if we didn't get any
        publicImages={publicImages}
        request={getStackScriptsByUser} key={1}
        isLinodeStackScripts={true}
      />,
    },
    {
      title: 'Community StackScripts',
      render: () => <StyledContainer
        onSelect={onSelect}
        // images is an optional prop, so just send an empty array if we didn't get any
        publicImages={publicImages}
        request={getCommunityStackscripts} key={2}
      />,
    },
  ]

  const myTabIndex = tabs.findIndex(tab => tab.title.toLowerCase().includes('my'));
  const linodeTabIndex = tabs.findIndex(tab => tab.title.toLowerCase().includes('linode'));
  const communityTabIndex = tabs.findIndex(tab => tab.title.toLowerCase().includes('community'));

  return (
    <TabbedPanel
      error={error}
      rootClass={classes.root}
      shrinkTabContent={(shrinkPanel) ? classes.creating : classes.selecting}
      header={(noHeader) ? "" : "Select StackScript"}
      tabs={tabs}
    />
  );
}

interface Params {
  page?: number;
  page_size?: number;
}

interface ContainerProps {
  request: (username: string, params: Params, filter: any) =>
    Promise<Linode.ResourcePage<Linode.StackScript.Response>>;
  onSelect?: (id: number, label: string, username: string, images: string[],
    userDefinedFields: Linode.StackScript.UserDefinedField[]) => void;
  profile: Linode.Profile;
  isLinodeStackScripts?: boolean;
  publicImages: Linode.Image[];
}

type CurrentFilter = 'label' | 'deploys' | 'revision';

interface ContainerState {
  currentPage: number;
  selected?: number;
  loading?: boolean;
  gettingMoreStackScripts: boolean;
  showMoreButtonVisible: boolean;
  data: any; // @TODO type correctly
  sortOrder: SortOrder;
  currentFilterType: CurrentFilter | null;
  currentFilter: any; // @TODO type correctly
  isSorting: boolean;
}

type ContainerCombinedProps = ContainerProps & WithStyles<ClassNames>;

class Container extends React.Component<ContainerCombinedProps, ContainerState> {
  state: ContainerState = {
    currentPage: 1,
    loading: true,
    gettingMoreStackScripts: false,
    data: [],
    showMoreButtonVisible: true,
    sortOrder: 'asc',
    currentFilterType: null,
    currentFilter: { ['+order_by']: 'deployments_total', ['+order']: 'desc' },
    isSorting: false,
  };

  mounted: boolean = false;

  getDataAtPage = (page: number,
    filter: any = this.state.currentFilter,
    isSorting: boolean = false) => {
    const { request, profile, isLinodeStackScripts } = this.props;
    this.setState({ gettingMoreStackScripts: true, isSorting });

    const filteredUser = (isLinodeStackScripts) ? 'linode' : profile.username;

    request(
      filteredUser,
      { page, page_size: 50 },
      filter)
      .then((response: Linode.ResourcePage<Linode.StackScript.Response>) => {
        if (!this.mounted) { return; }
        if (!response.data.length || response.data.length === response.results) {
          this.setState({ showMoreButtonVisible: false });
        }
        const newData = (isSorting) ? response.data : [...this.state.data, ...response.data];

        const newDataWithoutDeprecatedDistros =
          newData.filter(stackScript => this.hasNonDeprecatedImages(stackScript.images));

        // @TODO: deprecate this once compound filtering becomes available in the API
        // basically, if the result set after filtering out StackScripts with
        // deprecated distos is 0, request the next page with the same filter.
        if(newDataWithoutDeprecatedDistros.length === 0) {
          this.getNext();
          return;
        }
        
        this.setState({
          data: newDataWithoutDeprecatedDistros,
          gettingMoreStackScripts: false,
          loading: false,
          isSorting: false,
        });
      })
      .catch((e: any) => {
        if (!this.mounted) { return; }
        this.setState({ gettingMoreStackScripts: false });
      });
  }

  componentDidMount() {
    this.getDataAtPage(0);
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  getNext = () => {
    if (!this.mounted) { return; }
    this.setState(
      { currentPage: this.state.currentPage + 1 },
      () => this.getDataAtPage(this.state.currentPage, this.state.currentFilter, this.state.isSorting),
    );
  }

  hasNonDeprecatedImages = (stackScriptImages: string[]) => {
    const { publicImages } = this.props;
    for (const stackScriptImage of stackScriptImages) {
      for (const publicImage of publicImages) {
        if (stackScriptImage === publicImage.id) {
          return true;
        }
      }
    }
    return false;
  }

  handleSelectStackScript = (stackscript: Linode.StackScript.Response) => {
    if (!this.props.onSelect) { return; }
    this.props.onSelect(
      stackscript.id,
      stackscript.label,
      stackscript.username,
      stackscript.images,
      stackscript.user_defined_fields,
    );
    this.setState({ selected: stackscript.id });
  }

  handleClickStackScriptsTableHeader = () => {
    const { sortOrder } = this.state;
    const nextSortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
    this.getDataAtPage(1, { ['+order_by']: 'label', ['+order']: sortOrder }, true);
    this.setState({
      sortOrder: nextSortOrder,
      currentFilterType: 'label',
      currentFilter: { ['+order_by']: 'label', ['+order']: sortOrder },
    });
  }

  handleClickDeploymentsTableHeader = () => {
    const { sortOrder } = this.state;
    const nextSortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
    this.getDataAtPage(1, { ['+order_by']: 'deployments_active', ['+order']: sortOrder }, true);
    this.setState({
      sortOrder: nextSortOrder,
      currentFilterType: 'deploys',
      currentFilter: { ['+order_by']: 'deployments_active', ['+order']: sortOrder },
    });
  }

  handleClickRevisionsTableHeader = () => {
    const { sortOrder } = this.state;
    const nextSortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
    this.getDataAtPage(1, { ['+order_by']: 'updated', ['+order']: sortOrder }, true);
    this.setState({
      sortOrder: nextSortOrder,
      currentFilterType: 'revision',
      currentFilter: { ['+order_by']: 'updated', ['+order']: sortOrder },
    });
  }

  renderIcon = () => {
    const { sortOrder } = this.state;

    return (
      sortOrder === 'desc'
        ? <KeyboardArrowUp className="sortIcon" />
        : <KeyboardArrowDown className="sortIcon" />
    );
  }

  render() {
    const { classes, publicImages } = this.props;
    const { currentFilterType, isSorting } = this.state;

    if (this.state.loading) {
      return <CircleProgress noTopMargin />;
    }

    const selectProps = (!!this.props.onSelect)
      ? { onSelect: this.handleSelectStackScript }
      : {}

    return (
      <React.Fragment>
        <Table noOverflow={true} tableClass={classes.table}>
          <TableHead>
            <TableRow className={classes.tr}>
              {!!this.props.onSelect &&
                <TableCell className={classNames({
                  [classes.tableHead]: true,
                  [classes.stackscriptLabel]: true,
                })} />
              }
              <TableCell
                className={classNames({
                  [classes.tableHead]: true,
                  [classes.stackscriptTitles]: true,
                })}
                sortable
              >
                <Button
                  type="secondary"
                  className={classes.sortButton}
                  onClick={this.handleClickStackScriptsTableHeader}
                >
                  StackScripts
                  {currentFilterType === 'label' &&
                    this.renderIcon()
                  }
                </Button>
              </TableCell>
              <TableCell
                className={classNames({
                  [classes.tableHead]: true,
                  [classes.deploys]: true,
                })}
                noWrap
                sortable
              >
                <Button
                  type="secondary"
                  className={classes.sortButton}
                  onClick={this.handleClickDeploymentsTableHeader}
                >
                  Active Deploys
                  {currentFilterType !== 'label' && currentFilterType !== 'revision' &&
                    this.renderIcon()
                  }
                </Button>
              </TableCell>
              <TableCell
                className={classNames({
                  [classes.tableHead]: true,
                  [classes.revisions]: true,
                })}
                noWrap
                sortable
              >
                <Button
                  type="secondary"
                  className={classes.sortButton}
                  onClick={this.handleClickRevisionsTableHeader}
                >
                  Last Revision
                  {currentFilterType === 'revision' &&
                    this.renderIcon()
                  }
                </Button>
              </TableCell>
              <TableCell className={classes.tableHead}>Compatible Images</TableCell>
              {!this.props.onSelect &&
                <TableCell className={classNames({
                  [classes.tableHead]: true,
                  [classes.stackscriptLabel]: true,
                })} />
              }
            </TableRow>
          </TableHead>
          <StackScriptsSection
            isSorting={isSorting}
            selectedId={this.state.selected}
            data={this.state.data}
            getNext={() => this.getNext()}
            publicImages={publicImages}
            {...selectProps}
          />
        </Table>
        {this.state.showMoreButtonVisible && !isSorting &&
          <Button
            title="Show More StackScripts"
            onClick={this.getNext}
            type="secondary"
            disabled={this.state.gettingMoreStackScripts}
            style={{ marginTop: 32 }}
          >
            {!this.state.gettingMoreStackScripts
              ? 'Show More StackScripts'
              : 'Loading...'
            }
          </Button>
        }
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state: Linode.AppState) => ({
  profile: pathOr({}, ['resources', 'profile', 'data'], state),
});

const styled = withStyles(styles, { withTheme: true });

const StyledContainer = compose<Linode.TodoAny, Linode.TodoAny, Linode.TodoAny>(
  connect(mapStateToProps),
  styled,
)(Container);

export default styled(RenderGuard<CombinedProps>(SelectStackScriptPanel));
