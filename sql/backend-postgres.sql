--**********************************************************************
--*               Shock - OSDF reference implementation        
--* Authors:  
--*     Jared Wilkening (jared at mcs.anl.gov)
--*     Narayan Desai   (desai at mcs.anl.gov)
--*     Folker Meyer    (folker at anl.gov)
--**********************************************************************

drop table if exists nodes, files, indexes, attributes, acls, scopes, user_scopes, users cascade;

create table files (
	checksum		varchar(128) primary key,
	checksum_type	varchar(6),
	file_format		text,
	file_type		text,
	file_size		bigint,
	creation_date	timestamp default now()
);

create table nodes (
	id			bigserial primary key,
	file_name	text,
	checksum	varchar(128) references files (checksum),
	size		bigint
);

create table indexes (
	id				bigserial primary key,
	file_id			varchar(128) references files (checksum),
	type			varchar(64),
	records			bigint,
	format			text,
	seperator		char(1),
	creation_date	timestamp default now()
);

create table attributes (
	id			bigserial primary key,
	node_id		bigint references nodes (id),
	level		int default 0,
	index		int default null,
	container	char(1) default null,
	tag			text,
	value		text
);

create index node_attributes on attributes(node_id);
create unique index unique_attributes on attributes(node_id, level, tag) where index is null;
create unique index unique_array_attributes on attributes(node_id, level, index, tag) where index is not null;

create table scopes (
	id			bigserial primary key,
	name		text not null
);

create table users (
	id			bigserial primary key,
	login		text not null,
	email		text not null,
	fname		text not null,
	lname		text not null	
);

create table user_scopes (
	id			bigserial primary key,
	scope_id	bigint references scopes (id),
	user_id		bigint references users (id)
);

create table acls (
	id			bigserial primary key,
	node_id		bigint references nodes (id),
	scope_id	bigint references scopes (id),
	read		bool default false,
	write		bool default false,
	del			bool default false
);

create index node_acls on acls(node_id);


